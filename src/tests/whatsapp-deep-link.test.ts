/**
 * WhatsApp reminder deep link — format & encoding contract.
 *
 * The link is built from user-typed data (bill name, note, business name,
 * phone), so this suite pins the rules that keep the URL safe: full
 * percent-encoding, control/zero-width stripping, empty-field handling,
 * phone normalization and a deterministic length cap.
 */
import { describe, expect, it } from "vitest";
import {
  buildReminderMessage,
  buildWhatsAppLink,
  defaultBillingProfile,
  normalizePhone,
  sanitizeReminderText,
  validateWhatsAppLink,
  WHATSAPP_TEXT_LIMIT,
  type Bill,
  type BillingProfile,
} from "@/lib/billing";

const TODAY = new Date("2026-03-08T00:00:00Z");

const baseBill: Bill = {
  id: "b1",
  name: "Internet Rumah",
  amount: 300_000,
  dueDate: "2026-03-10",
  taxPercent: 11,
  discountMode: "percent",
  discountValue: 10,
  recurring: "monthly",
  icon: "wifi",
  phone: "081234567890",
  note: "Bayar via BCA",
  paid: false,
  createdAt: "2026-03-01T00:00:00.000Z",
};

const profile: BillingProfile = { ...defaultBillingProfile, businessName: "Toko Maju & Co" };

function link(bill: Partial<Bill> = {}, p: BillingProfile = profile): string {
  return buildWhatsAppLink({ ...baseBill, ...bill }, p, TODAY);
}

function textOf(url: string): string {
  return new URL(url).searchParams.get("text") ?? "";
}

describe("WhatsApp deep link — encoding", () => {
  it("never emits characters that would break the URL", () => {
    const url = link({
      name: 'Sewa 100% #A&B?=+ "kantor" <script>',
      note: "ref: 50%+10 & 20/30; a=b",
    });
    expect(url).not.toMatch(/[\s"'<>`\\]/);
    const query = url.slice(url.indexOf("?text=") + 6);
    expect(query).not.toMatch(/[#&=+]/);
    expect(query).toContain("%0A");
    expect(validateWhatsAppLink(url).ok).toBe(true);
  });

  it("round-trips the message through decodeURIComponent", () => {
    const bill = { ...baseBill, name: "Listrik & Air", note: "100% + pajak" };
    const url = buildWhatsAppLink(bill, profile, TODAY);
    expect(textOf(url)).toBe(sanitizeReminderText(buildReminderMessage(bill, profile, TODAY)));
  });

  it("encodes emoji, non-latin text and multi-byte characters intact", () => {
    const url = link({ name: "Tagihan 会社 🚀", note: "café — naïve" });
    const text = textOf(url);
    expect(text).toContain("Tagihan 会社 🚀");
    expect(text).toContain("café — naïve");
    expect(validateWhatsAppLink(url).ok).toBe(true);
  });

  it("percent-encodes a literal percent sign so no invalid escape survives", () => {
    const url = link({ name: "Diskon %41 %ZZ" });
    expect(url).toContain("%25");
    expect(() => decodeURIComponent(url)).not.toThrow();
  });
});

describe("WhatsApp deep link — sanitization", () => {
  it("strips control, zero-width and bidi characters", () => {
    const dirty = "Halo\u0000\u0007 dunia\u200b\u202e\ufeff";
    expect(sanitizeReminderText(dirty)).toBe("Halo dunia");
  });

  it("normalizes CRLF and collapses excess blank lines", () => {
    expect(sanitizeReminderText("a\r\nb\r\n\r\n\r\n\r\nc")).toBe("a\nb\n\nc");
    expect(sanitizeReminderText("  trailing   \n  ")).toBe("trailing");
  });

  it("caps the text length deterministically", () => {
    const long = "x".repeat(WHATSAPP_TEXT_LIMIT + 500);
    const capped = sanitizeReminderText(long);
    expect(capped).toHaveLength(WHATSAPP_TEXT_LIMIT);
    expect(capped.endsWith("…")).toBe(true);
  });

  it("keeps a long note inside the limit after building the link", () => {
    const url = link({ note: "n".repeat(5_000) });
    expect(textOf(url).length).toBeLessThanOrEqual(WHATSAPP_TEXT_LIMIT);
    expect(validateWhatsAppLink(url).ok).toBe(true);
  });

  it("treats non-string input as empty", () => {
    expect(sanitizeReminderText(undefined)).toBe("");
    expect(sanitizeReminderText(null)).toBe("");
    expect(sanitizeReminderText(42)).toBe("");
  });
});

describe("WhatsApp deep link — empty and invalid fields", () => {
  it("omits the recipient when the phone is missing", () => {
    const { phone: _p, ...noPhone } = baseBill;
    const url = buildWhatsAppLink(noPhone, profile, TODAY);
    const parsed = validateWhatsAppLink(url);
    expect(parsed).toMatchObject({ ok: true, phone: null });
    expect(new URL(url).pathname).toBe("/");
  });

  it.each(["", "   ", "abc", "12", "-", "+", "0".repeat(20)])(
    "keeps the link valid but recipient-less for phone %j",
    (phone) => {
      const url = link({ phone });
      const parsed = validateWhatsAppLink(url);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(parsed.phone).toBeNull();
    },
  );

  it("normalizes formatted Indonesian numbers to a digit-only recipient", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizePhone("+62 812 3456 7890")).toBe("6281234567890");
    expect(new URL(link({ phone: "(0812) 3456 7890" })).pathname).toBe("/6281234567890");
  });

  it("omits empty optional fields from the message instead of printing blanks", () => {
    const { note: _n, ...noNote } = baseBill;
    const text = textOf(
      buildWhatsAppLink(
        { ...noNote, taxPercent: 0, discountValue: 0, recurring: "none" },
        defaultBillingProfile,
        TODAY,
      ),
    );
    expect(text).not.toContain("Catatan:");
    expect(text).not.toContain("Diskon:");
    expect(text).not.toContain("Pajak");
    expect(text).not.toContain("Siklus:");
    expect(text).toContain("Tim Keuangan");
    expect(text).not.toMatch(/\n{3,}/);
  });

  it("still builds a usable link when the whole profile is blank", () => {
    const url = link({}, { ...defaultBillingProfile, businessName: "   ", footerNote: "  " });
    const parsed = validateWhatsAppLink(url);
    expect(parsed.ok).toBe(true);
    expect(textOf(url)).toContain("Tim Keuangan");
  });

  it("renders a valid link for an invalid due date without leaking NaN", () => {
    const url = link({ dueDate: "2026-02-30" });
    const text = textOf(url);
    expect(text).not.toContain("NaN");
    expect(text).toContain("Jatuh tempo: -");
    expect(validateWhatsAppLink(url).ok).toBe(true);
  });
});

describe("validateWhatsAppLink", () => {
  it("accepts a freshly built link", () => {
    expect(validateWhatsAppLink(link())).toMatchObject({ ok: true, phone: "6281234567890" });
  });

  it.each([
    ["", "malformed"],
    ["not a url", "malformed"],
    ["https://wa.me/62812?text=hi there", "malformed"],
    ["http://wa.me/?text=hi", "protocol"],
    ["https://evil.example/?text=hi", "host"],
    ["https://wa.me/62-812?text=hi", "phone"],
    ["https://wa.me/62812345678", "text"],
    ["https://wa.me/62812345678?text=%20", "text"],
  ] as const)("rejects %j with reason %s", (input, reason) => {
    expect(validateWhatsAppLink(input)).toEqual({ ok: false, reason });
  });

  it("rejects an over-long text parameter", () => {
    const over = `https://wa.me/?text=${encodeURIComponent("y".repeat(WHATSAPP_TEXT_LIMIT + 1))}`;
    expect(validateWhatsAppLink(over)).toEqual({ ok: false, reason: "length" });
  });
});
