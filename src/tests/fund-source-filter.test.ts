/**
 * Unit tests for the fund-source filter helpers. The critical invariant:
 * a multi-source list must never lose rows silently because of a stale or
 * invalid persisted filter.
 */
import { describe, expect, it } from "vitest";
import { filterWallets, matchesFilters, sanitizeFilters } from "@/lib/fund-source-filter";

const wallets = [
  { id: "1", name: "Dompet Tunai", type: "cash" },
  { id: "2", name: "BCA Utama", type: "bank" },
  { id: "3", name: "GoPay", type: "ewallet" },
];

describe("filterWallets", () => {
  it("returns every wallet with neutral filters", () => {
    expect(filterWallets(wallets, { query: "", type: "all" })).toHaveLength(3);
  });

  it("keeps every matching source when several share a type", () => {
    const multi = [...wallets, { id: "4", name: "BCA Bisnis", type: "bank" }];
    const result = filterWallets(multi, { query: "", type: "bank" });
    expect(result.map((w) => w.id)).toEqual(["2", "4"]);
  });

  it("matches names case-insensitively and ignores surrounding spaces", () => {
    expect(filterWallets(wallets, { query: "  gopay ", type: "all" })).toHaveLength(1);
  });

  it("does not mutate the source array", () => {
    const input = [...wallets];
    filterWallets(input, { query: "bca", type: "bank" });
    expect(input).toHaveLength(3);
  });

  it("matchesFilters combines type and query", () => {
    expect(matchesFilters(wallets[1]!, { query: "bca", type: "bank" })).toBe(true);
    expect(matchesFilters(wallets[1]!, { query: "bca", type: "cash" })).toBe(false);
  });
});

describe("sanitizeFilters", () => {
  it("leaves valid filters untouched", () => {
    const r = sanitizeFilters(wallets, { query: "bca", type: "bank" });
    expect(r.changed).toBe(false);
    expect(r.filters).toEqual({ query: "bca", type: "bank" });
  });

  it("resets a type filter that matches no wallet", () => {
    const onlyBank = [wallets[1]!];
    const r = sanitizeFilters(onlyBank, { query: "", type: "cash" });
    expect(r.filters.type).toBe("all");
    expect(r.reasons).toContain("type");
    expect(filterWallets(onlyBank, r.filters)).toHaveLength(1);
  });

  it("clears a query that would hide every wallet", () => {
    const r = sanitizeFilters(wallets, { query: "tidak-ada", type: "all" });
    expect(r.filters.query).toBe("");
    expect(r.reasons).toContain("query");
    expect(filterWallets(wallets, r.filters)).toHaveLength(3);
  });

  it("resets both filters when both are stale", () => {
    const r = sanitizeFilters(wallets, { query: "zzz", type: "crypto" });
    expect(r.filters).toEqual({ query: "", type: "all" });
    expect(r.reasons).toEqual(["type", "query"]);
  });

  it("is idempotent", () => {
    const first = sanitizeFilters(wallets, { query: "zzz", type: "crypto" });
    const second = sanitizeFilters(wallets, first.filters);
    expect(second.changed).toBe(false);
    expect(second.filters).toEqual(first.filters);
  });

  it("keeps a partial filter that still matches at least one wallet", () => {
    const r = sanitizeFilters(wallets, { query: "", type: "cash" });
    expect(r.changed).toBe(false);
    expect(filterWallets(wallets, r.filters)).toHaveLength(1);
  });

  it("never changes filters when there is no data yet", () => {
    const r = sanitizeFilters([], { query: "abc", type: "cash" });
    expect(r.changed).toBe(false);
  });
});
