/**
 * WhatsApp reminder deep-link builder — encoding rules and rejection contract.
 *
 * Complements `whatsapp-deep-link.test.ts` by focusing on the builder output as
 * a URL: strict character policy on the emitted string, exact percent-encoding
 * of reserved characters, and the reasons `validateWhatsAppLink` rejects
 * malformed or hostile inputs.
 */
import { describe, expect, it } from "vitest";
import {
  buildWhatsAppLink,
  defaultBillingProfile,
  sanitizeReminderText,
  validateWhatsAppLink,
  WHATSAPP_TEXT_LIMIT,
  type Bill,
} from "@/lib/billing";

const TODAY = new Date("2026-03-08T00:00:00Z");

const bill: Bill = {
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

const build = (patch: Partial<Bill> = {}) =>
  buildWhatsAppLink({ ...bill, ...patch }, defaultBillingProfile, TODAY);

describe("buildWhatsAppLink — URL shape", () => {
  it("always emits an https wa.me link with a single text parameter", () => {
    const url = new URL(build());
    expect(url.protocol).toBe("https:");
    expect(url.host).toBe("wa.me");
    expect([...url.searchParams.keys()]).toEqual(["text"]);
    expect(url.pathname).toBe("/6281234567890");
  });

  it("produces a link that survives a round-trip through URL parsing", () => {
    const url = build({ name: "A & B ? = # + / \\ %" });
    expect(new URL(url).toString()).toBe(url);
    expect(validateWhatsAppLink(url).ok).toBe(true);
  });

  it.each([
    [" ", "%20"],
    ["&", "%26"],
    ["#", "%23"],
    ["+", "%2B"],
    ["=", "%3D"],
    ["?", "%3F"],
    ["/", "%2F"],
    ["%", "%25"],
  ])("percent-encodes %j as %s inside the text parameter", (char, encoded) => {
    const url = build({ name: `X${char}Y` });
    const query = url.slice(url.indexOf("?text=") + 6);
    expect(query).toContain(encoded);
  });

  it("never leaks characters that break a URL out of the query string", () => {
    const url = build({ name: `"'<>\`\\ \n\t`, note: "line\r\nbreak" });
    expect(url).not.toMatch(/[\s"'<>`\\]/);
  });

  it("keeps the decoded text identical to the sanitized message", () => {
    const url = build({ note: "diskon 50% & pajak 11%" });
    const text = new URL(url).searchParams.get("text") ?? "";
    expect(sanitizeReminderText(text)).toBe(text);
    expect(text).toContain("diskon 50% & pajak 11%");
  });
});

describe("validateWhatsAppLink — rejections", () => {
  it.each([
    ["", "malformed"],
    ["   ", "malformed"],
    ["wa.me/62812?text=hi", "malformed"],
    ["https://wa.me/62812?text=hi<script>", "malformed"],
    ['https://wa.me/62812?text=say "hi"', "malformed"],
    ["https://wa.me/62812?text=a\\b", "malformed"],
    ["http://wa.me/62812345678?text=hi", "protocol"],
    ["ftp://wa.me/62812345678?text=hi", "protocol"],
    ["https://wa.me.evil.test/62812345678?text=hi", "host"],
    ["https://api.whatsapp.com/send?text=hi", "host"],
    ["https://wa.me/62812abc?text=hi", "phone"],
    ["https://wa.me/1234567?text=hi", "phone"],
    ["https://wa.me/62812345678", "text"],
    ["https://wa.me/62812345678?text=", "text"],
  ] as const)("rejects %j with reason %s", (input, reason) => {
    expect(validateWhatsAppLink(input)).toEqual({ ok: false, reason });
  });

  it.each([null, undefined, 42, {}, []])("rejects non-string input %j", (input) => {
    expect(validateWhatsAppLink(input as unknown as string)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("rejects a text parameter beyond the hard limit", () => {
    const over = `https://wa.me/62812345678?text=${encodeURIComponent(
      "z".repeat(WHATSAPP_TEXT_LIMIT + 1),
    )}`;
    expect(validateWhatsAppLink(over)).toEqual({ ok: false, reason: "length" });
  });

  it("accepts every link the builder produces, including hostile field content", () => {
    const hostile = [
      { name: "javascript:alert(1)" },
      { note: "https://evil.test/?a=1&b=2#frag" },
      { name: "\u202eevil\u202c", note: "\u0000\u200b" },
      { phone: "+62 (812) 3456-7890" },
      { note: "q".repeat(WHATSAPP_TEXT_LIMIT * 2) },
    ] satisfies Partial<Bill>[];
    for (const patch of hostile) {
      expect(validateWhatsAppLink(build(patch)), JSON.stringify(patch)).toMatchObject({ ok: true });
    }
  });
});
