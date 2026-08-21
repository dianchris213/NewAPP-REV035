import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  buildWhatsAppLink,
  sanitizeReminderText,
  validateWhatsAppLink,
  WHATSAPP_TEXT_LIMIT,
  type Bill,
  type BillingProfile,
} from "@/lib/billing";

/**
 * Property-based coverage for the WhatsApp deep-link encoder: for ANY input the
 * built link must be a valid, fully percent-encoded `https://wa.me/...` URL that
 * round-trips back to the sanitized message.
 */

const TODAY = new Date("2026-03-08T00:00:00.000Z");

const profile = (over: Partial<BillingProfile> = {}): BillingProfile =>
  ({ businessName: "Toko Maju", footerNote: "", ...over }) as BillingProfile;

const bill = (over: Partial<Bill> = {}): Bill =>
  ({
    id: "b1",
    name: "Internet",
    amount: 250000,
    dueDate: "2026-03-20",
    taxPercent: 0,
    discountMode: "amount",
    discountValue: 0,
    recurring: "none",
    icon: "wifi",
    phone: "6281234567890",
    note: "",
    ...over,
  }) as Bill;

/** Only `%`, digits/letters after it, and the unreserved set may appear. */
const ENCODED_TEXT = /^(?:[A-Za-z0-9\-._~]|%[0-9A-F]{2})*$/;

const rawText = () =>
  fc.oneof(
    fc.string({ maxLength: 120 }),
    fc.string({ unit: "grapheme", maxLength: 120 }),
    fc.string({ unit: fc.constantFrom(" ", "\t", "\n", "\r\n", "\u00a0", "\u200b"), maxLength: 40 }),
    fc.constantFrom(
      "%20%0A already encoded",
      "a&b=c#d+e",
      "emoji 🎉🚀 dan aksara 漢字 Кириллица",
      "'!()*",
      "<script>alert(1)</script>",
    ),
  );

describe("buildWhatsAppLink — properties", () => {
  it("always produces a link that passes the strict format gate", () => {
    fc.assert(
      fc.property(rawText(), rawText(), rawText(), (name, note, footer) => {
        const link = buildWhatsAppLink(
          bill({ name: name || "Tagihan", note }),
          profile({ footerNote: footer }),
          TODAY,
        );
        const result = validateWhatsAppLink(link);
        expect(result.ok).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it("query text contains only unreserved characters and percent-triplets", () => {
    fc.assert(
      fc.property(rawText(), (note) => {
        const link = buildWhatsAppLink(bill({ note }), profile(), TODAY);
        const encoded = link.split("?text=")[1] ?? "";
        expect(encoded).toMatch(ENCODED_TEXT);
      }),
      { numRuns: 300 },
    );
  });

  it("decodes back to exactly the sanitized message (round-trip)", () => {
    fc.assert(
      fc.property(rawText(), (note) => {
        const b = bill({ note });
        const link = buildWhatsAppLink(b, profile(), TODAY);
        const decoded = new URL(link).searchParams.get("text") ?? "";
        expect(decoded).toBe(sanitizeReminderText(decoded));
        expect(decoded.length).toBeLessThanOrEqual(WHATSAPP_TEXT_LIMIT);
      }),
      { numRuns: 200 },
    );
  });

  it("already-encoded input is escaped again, never decoded by WhatsApp", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: fc.constantFrom("%20", "%0A", "%26", "%2F"), minLength: 1, maxLength: 12 }),
        (note) => {
          const link = buildWhatsAppLink(bill({ note }), profile(), TODAY);
          const decoded = new URL(link).searchParams.get("text") ?? "";
          expect(decoded).toContain(note);
          expect(link).toContain("%25");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("whitespace variants never leak raw spaces, tabs or CR into the URL", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: fc.constantFrom(" ", "\t", "\n", "\r\n", "x"), maxLength: 60 }),
        (note) => {
          const link = buildWhatsAppLink(bill({ note }), profile(), TODAY);
          expect(link).not.toMatch(/[\s]/);
          expect(link).not.toContain("%09");
          expect(link).not.toContain("%0D");
        },
      ),
      { numRuns: 200 },
    );
  });

  it("phone segment is either absent or 8–15 digits, whatever was typed", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 25 }), (phone) => {
        const link = buildWhatsAppLink(bill({ phone }), profile(), TODAY);
        const path = new URL(link).pathname.replace(/^\//, "");
        expect(path === "" || /^\d{8,15}$/.test(path)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it("random unicode never exceeds the documented text limit", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 6000 }), (note) => {
        const link = buildWhatsAppLink(bill({ note }), profile(), TODAY);
        const decoded = new URL(link).searchParams.get("text") ?? "";
        expect(decoded.length).toBeLessThanOrEqual(WHATSAPP_TEXT_LIMIT);
        expect(validateWhatsAppLink(link).ok).toBe(true);
      }),
      { numRuns: 60 },
    );
  });
});
