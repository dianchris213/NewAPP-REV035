import { describe, expect, it } from "vitest";
import {
  billStatus,
  buildReminderMessage,
  buildWhatsAppLink,
  computeTotals,
  defaultBillingProfile,
  isIsoDate,
  nextDueDate,
  normalizeBills,
  normalizePhone,
  parseBillDraft,
  parseBillingProfile,
  suggestBillIcon,
  DEFAULT_BILL_ICON,
  type Bill,
} from "@/lib/billing";

const draft = {
  name: "Internet Rumah",
  amount: 300000,
  dueDate: "2026-03-10",
  taxPercent: 11,
  discountMode: "percent" as const,
  discountValue: 10,
  recurring: "monthly" as const,
  phone: "081234567890",
};

const bill: Bill = {
  ...parseBillDraft(draft)!,
  id: "b1",
  paid: false,
  createdAt: "2026-03-01T00:00:00.000Z",
};

describe("billing math", () => {
  it("applies the discount before the tax and returns integers", () => {
    const totals = computeTotals({
      amount: 300000,
      taxPercent: 11,
      discountMode: "percent",
      discountValue: 10,
    });
    expect(totals).toEqual({
      subtotal: 300000,
      discount: 30000,
      taxable: 270000,
      tax: 29700,
      total: 299700,
    });
  });

  it("never lets a fixed discount push the total below zero", () => {
    const totals = computeTotals({
      amount: 50000,
      taxPercent: 11,
      discountMode: "fixed",
      discountValue: 999999,
    });
    expect(totals.discount).toBe(50000);
    expect(totals.total).toBe(0);
  });

  it("clamps invalid percentages instead of producing NaN", () => {
    const totals = computeTotals({
      amount: 100000,
      taxPercent: Number.NaN,
      discountMode: "percent",
      discountValue: 500,
    });
    expect(totals.tax).toBe(0);
    expect(totals.discount).toBe(100000);
  });
});

describe("validation gate", () => {
  it("accepts a valid draft and normalizes the phone number", () => {
    const parsed = parseBillDraft(draft);
    expect(parsed?.phone).toBe("6281234567890");
    expect(parsed?.amount).toBe(300000);
  });

  it.each([
    ["short name", { ...draft, name: "a" }],
    ["zero amount", { ...draft, amount: 0 }],
    ["missing date", { ...draft, dueDate: "" }],
    ["impossible date", { ...draft, dueDate: "2026-02-30" }],
  ])("rejects %s", (_label, input) => {
    expect(parseBillDraft(input)).toBeNull();
  });

  it("validates ISO dates strictly", () => {
    expect(isIsoDate("2026-01-31")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("31-01-2026")).toBe(false);
  });

  it("normalizes phone numbers or returns undefined", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizePhone("abc")).toBeUndefined();
    expect(normalizePhone("12")).toBeUndefined();
  });

  it("drops malformed persisted rows", () => {
    const rows = normalizeBills([bill, null, { name: "x" }, { ...bill, amount: -5 }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Internet Rumah");
  });

  it("falls back to a safe branding profile", () => {
    expect(parseBillingProfile({ brandColor: "javascript:alert(1)" }).brandColor).toBe(
      defaultBillingProfile.brandColor,
    );
    expect(parseBillingProfile({ template: "bogus" }).template).toBe("professional");
  });
});

describe("recurring schedule", () => {
  it("rolls a monthly bill forward and clamps short months", () => {
    expect(nextDueDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextDueDate("2026-03-10", "monthly")).toBe("2026-04-10");
    expect(nextDueDate("2026-12-15", "monthly")).toBe("2027-01-15");
    expect(nextDueDate("2026-03-10", "weekly")).toBe("2026-03-17");
    expect(nextDueDate("2026-03-10", "yearly")).toBe("2027-03-10");
    expect(nextDueDate("2026-03-10", "none")).toBeNull();
  });

  it("derives the status from the due date", () => {
    expect(billStatus(bill, new Date("2026-03-01T00:00:00Z"))).toBe("upcoming");
    expect(billStatus(bill, new Date("2026-03-09T00:00:00Z"))).toBe("due-soon");
    expect(billStatus(bill, new Date("2026-03-12T00:00:00Z"))).toBe("overdue");
    expect(billStatus({ ...bill, paid: true }, new Date("2026-03-12T00:00:00Z"))).toBe("paid");
  });
});

describe("WhatsApp reminder", () => {
  it("includes the invoice details and the grand total", () => {
    const message = buildReminderMessage(
      bill,
      { ...defaultBillingProfile, businessName: "Toko Maju" },
      new Date("2026-03-08T00:00:00Z"),
    );
    expect(message).toContain("Toko Maju");
    expect(message).toContain("Internet Rumah");
    expect(message).toContain("jatuh tempo dalam 2 hari");
    expect(message).toContain("Rp 299.700");
  });

  it("builds a wa.me link addressed to the stored number", () => {
    const link = buildWhatsAppLink(bill, defaultBillingProfile, new Date("2026-03-08T00:00:00Z"));
    expect(link.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    expect(link).not.toContain(" ");
  });

  it("falls back to a recipient-less link with no phone", () => {
    const { phone: _phone, ...noPhone } = bill;
    const link = buildWhatsAppLink(
      noPhone,
      defaultBillingProfile,
      new Date("2026-03-08T00:00:00Z"),
    );
    expect(link.startsWith("https://wa.me/?text=")).toBe(true);
  });
});

describe("WhatsApp deep link format", () => {
  const profile = { ...defaultBillingProfile, businessName: "Toko Maju & Co" };
  const today = new Date("2026-03-08T00:00:00Z");

  it("percent-encodes newlines, spaces and special characters", () => {
    const tricky: Bill = {
      ...bill,
      name: "Sewa 100% #A&B?=+ \"kantor\"",
      note: "Bayar via BCA/BRI; ref: 50%+10",
    };
    const link = buildWhatsAppLink(tricky, profile, today);
    const query = link.slice(link.indexOf("?text=") + "?text=".length);
    expect(link).not.toMatch(/[\s"<>]/);
    expect(query).not.toMatch(/[#&=+]/);
    expect(query).toContain("%0A");
    expect(decodeURIComponent(query)).toBe(buildReminderMessage(tricky, profile, today));
  });

  it("produces a parseable URL whose text round-trips", () => {
    const url = new URL(buildWhatsAppLink(bill, profile, today));
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/6281234567890");
    expect(url.searchParams.get("text")).toBe(buildReminderMessage(bill, profile, today));
  });

  it("omits empty optional fields from the message", () => {
    const { note: _note, ...noNote } = bill;
    const message = buildReminderMessage(
      { ...noNote, taxPercent: 0, discountValue: 0 },
      { ...defaultBillingProfile },
      today,
    );
    expect(message).not.toContain("Catatan:");
    expect(message).not.toContain("Diskon:");
    expect(message).not.toContain("Pajak");
    expect(message).toContain("Tim Keuangan");
  });

  it("keeps the link recipient-less and valid for an invalid phone", () => {
    const url = new URL(buildWhatsAppLink({ ...bill, phone: "12" }, profile, today));
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("text")).toBeTruthy();
  });

  it("suggests an icon from the bill name and falls back safely", () => {
    expect(suggestBillIcon("Tagihan Internet IndiHome")).toBe("wifi");
    expect(suggestBillIcon("Token Listrik PLN")).toBe("bolt");
    expect(suggestBillIcon("Sesuatu")).toBe(DEFAULT_BILL_ICON);
    expect(parseBillDraft({ ...draft, name: "Kuota Data" })?.icon).toBe("smartphone");
    expect(parseBillDraft({ ...draft, icon: "bogus" })?.icon).toBe("wifi");
  });
});
