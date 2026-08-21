import { describe, expect, it } from "vitest";
import {
  AMOUNT_ERROR,
  formatAmountInput,
  isDottedAmount,
  sanitizeAmountInput,
  validateAmountInput,
} from "@/lib/billing";

describe("nominal input formatting", () => {
  it("keeps digits only and strips leading zeros", () => {
    expect(sanitizeAmountInput("Rp 5.000")).toBe("5000");
    expect(sanitizeAmountInput("-120000")).toBe("120000");
    expect(sanitizeAmountInput("007")).toBe("7");
    expect(sanitizeAmountInput("12,5")).toBe("125");
    expect(sanitizeAmountInput(null)).toBe("");
  });

  it("renders dotted thousands like the transaction sheet", () => {
    expect(formatAmountInput("5000")).toBe("5.000");
    expect(formatAmountInput("120000")).toBe("120.000");
    expect(formatAmountInput("")).toBe("");
  });

  it("recognizes only canonical dotted amounts", () => {
    expect(isDottedAmount("5.000")).toBe(true);
    expect(isDottedAmount("120.000")).toBe(true);
    expect(isDottedAmount("5.00")).toBe(false);
    expect(isDottedAmount("5,000")).toBe(false);
    expect(isDottedAmount(5000)).toBe(false);
  });
});

describe("nominal validation gate", () => {
  it("accepts dotted and plain positive amounts", () => {
    expect(validateAmountInput("5.000")).toEqual({ ok: true, value: 5000 });
    expect(validateAmountInput("120.000")).toEqual({ ok: true, value: 120000 });
    expect(validateAmountInput(5000)).toEqual({ ok: true, value: 5000 });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["abc", "invalid"],
    ["5.00", "invalid"],
    ["5,000", "invalid"],
    ["-5000", "invalid"],
    ["1e5", "invalid"],
    ["0", "range"],
    ["0.000", "range"],
  ] as const)("rejects %s", (input, reason) => {
    const result = validateAmountInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(reason);
      expect(AMOUNT_ERROR[result.reason]).toBeTruthy();
    }
  });
});
