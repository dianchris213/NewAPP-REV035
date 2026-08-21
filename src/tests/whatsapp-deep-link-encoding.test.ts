/**
 * WhatsApp reminder deep-link encoding — edge cases.
 *
 * Emojis, non-ASCII letters, whitespace variants and already percent-encoded
 * input must all round-trip through `buildWhatsAppLink` → `validateWhatsAppLink`
 * → `decodeURIComponent` without corrupting or double-decoding the message.
 */
import { describe, expect, it } from "vitest";
import {
  buildWhatsAppLink,
  defaultBillingProfile,
  sanitizeReminderText,
  validateWhatsAppLink,
  type Bill,
} from "@/lib/billing";

const TODAY = new Date("2026-03-08T00:00:00Z");

const base: Bill = {
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
  note: "",
  paid: false,
  createdAt: "2026-03-01T00:00:00.000Z",
};

/**
 * Build a link and return the `text` param as the receiving app sees it.
 * `validateWhatsAppLink` reads it through `URLSearchParams`, which already
 * percent-decodes, so no extra `decodeURIComponent` is applied here.
 */
function decodedText(patch: Partial<Bill>): string {
  const link = buildWhatsAppLink({ ...base, ...patch }, defaultBillingProfile, TODAY);
  const result = validateWhatsAppLink(link);
  expect(result.ok, `link rejected: ${JSON.stringify(result)}`).toBe(true);
  if (!result.ok) throw new Error("unreachable");
  return result.text;
}

describe("deep-link encoding — emojis and non-ASCII", () => {
  it("preserves multi-byte emoji (including ZWJ-free surrogate pairs)", () => {
    const text = decodedText({ name: "Listrik 💡", note: "Bayar cepat 🚀🙏" });
    expect(text).toContain("Listrik 💡");
    expect(text).toContain("Bayar cepat 🚀🙏");
  });

  it("percent-encodes emoji as UTF-8 bytes in the raw URL", () => {
    const link = buildWhatsAppLink({ ...base, name: "Listrik 💡" }, defaultBillingProfile, TODAY);
    expect(link).toContain("%F0%9F%92%A1");
    expect(link).not.toContain("💡");
  });

  it("preserves accented, Cyrillic and CJK letters", () => {
    const text = decodedText({ name: "Café Ürün 東京 Привет" });
    expect(text).toContain("Café Ürün 東京 Привет");
  });

  it("keeps combining marks intact without normalizing them away", () => {
    const text = decodedText({ name: "Wi\u0301fi" });
    expect(text).toContain("Wi\u0301fi");
  });
});

describe("deep-link encoding — whitespace", () => {
  it("encodes spaces as %20 and never as '+'", () => {
    const link = buildWhatsAppLink(
      { ...base, name: "Internet Rumah" },
      defaultBillingProfile,
      TODAY,
    );
    expect(link).toContain("%20");
    expect(link.split("?text=")[1]).not.toContain("+");
    expect(decodedText({ name: "Internet Rumah" })).toContain("Internet Rumah");
  });

  it("encodes newlines as %0A and keeps the line structure", () => {
    const link = buildWhatsAppLink(base, defaultBillingProfile, TODAY);
    expect(link).toContain("%0A");
    expect(decodedText({}).split("\n").length).toBeGreaterThan(3);
  });

  it("normalizes CRLF and tabs before encoding", () => {
    expect(sanitizeReminderText("a\r\nb")).toBe("a\nb");
    expect(sanitizeReminderText("a\tb")).toBe("ab");
    const text = decodedText({ note: "baris\r\nkedua" });
    expect(text).toContain("baris\nkedua");
    expect(text).not.toContain("\r");
  });

  it("collapses runs of blank lines and trims edges", () => {
    expect(sanitizeReminderText("\n\n  a\n\n\n\nb  \n\n")).toBe("a\n\nb");
  });

  it("strips zero-width and bidi-override whitespace lookalikes", () => {
    const text = decodedText({ name: "Inter\u200bnet\u202e" });
    expect(text).toContain("Internet");
    expect(text).not.toMatch(/[\u200b\u202e]/);
  });
});

describe("deep-link encoding — already-encoded input", () => {
  it("double-encodes a literal percent sequence so it decodes back verbatim", () => {
    const link = buildWhatsAppLink({ ...base, name: "Diskon%2050" }, defaultBillingProfile, TODAY);
    expect(link).toContain("Diskon%252050");
    expect(decodedText({ name: "Diskon%2050" })).toContain("Diskon%2050");
  });

  it("does not treat an embedded encoded query string as URL structure", () => {
    const hostile = "?text=hacked&utm=1#frag";
    const link = buildWhatsAppLink({ ...base, note: hostile }, defaultBillingProfile, TODAY);
    const url = new URL(link);
    expect([...url.searchParams.keys()]).toEqual(["text"]);
    expect(url.hash).toBe("");
    expect(decodedText({ note: hostile })).toContain(hostile);
  });

  it("encodes reserved characters that would otherwise split the URL", () => {
    const link = buildWhatsAppLink(
      { ...base, name: "A&B=C#D+E/F?G" },
      defaultBillingProfile,
      TODAY,
    );
    const query = link.split("?text=")[1] ?? "";
    expect(query).not.toMatch(/[&=#+/?]/);
    expect(decodedText({ name: "A&B=C#D+E/F?G" })).toContain("A&B=C#D+E/F?G");
  });

  it("encodes the characters encodeURIComponent leaves literal", () => {
    const query =
      buildWhatsAppLink({ ...base, name: "O'Brien !()*" }, defaultBillingProfile, TODAY).split(
        "?text=",
      )[1] ?? "";
    expect(query).not.toMatch(/['!()*]/);
    expect(decodedText({ name: "O'Brien !()*" })).toContain("O'Brien !()*");
  });

  it("still validates when every field is hostile at once", () => {
    const text = decodedText({
      name: "💥 <script>alert('x')</script>",
      note: "https://evil.test/?a=b&c=d 🚀",
      phone: "0812-3456-7890",
    });
    expect(text).toContain("<script>");
    expect(text).toContain("https://evil.test/?a=b&c=d 🚀");
  });
});
