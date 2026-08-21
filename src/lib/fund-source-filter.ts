/**
 * Pure filter logic for fund sources (Sumber Dana).
 *
 * Invariant enforced here: a persisted filter must never silently hide every
 * fund source. If a stored filter cannot match any wallet, it is treated as
 * invalid and sanitized back to a neutral value ("all" / empty query), so the
 * list always shows the user's real data instead of an empty state.
 */

import { z } from "zod";

/** Strict schema for the persisted filter payload. Anything else -> "all". */
export const fundSourceTypeFilterSchema = z.enum(["all", "cash", "bank", "ewallet"]);

export const fundSourceFiltersSchema = z
  .object({
    query: z.string().max(40),
    type: fundSourceTypeFilterSchema,
  })
  .strict();

export type StoredFundSourceType = z.infer<typeof fundSourceTypeFilterSchema>;

/**
 * Parses a persisted type filter with a hard fallback to "all".
 * `availableTypes` (optional) guards against API shape/vocabulary changes: a
 * syntactically valid value that no longer exists in the data is also reset.
 */
export function parseStoredTypeFilter(
  value: unknown,
  availableTypes?: readonly string[],
): StoredFundSourceType {
  const parsed = fundSourceTypeFilterSchema.safeParse(value);
  if (!parsed.success) return "all";
  if (parsed.data === "all") return "all";
  if (availableTypes && availableTypes.length > 0 && !availableTypes.includes(parsed.data)) {
    return "all";
  }
  return parsed.data;
}

/** Parses a whole persisted filter object, falling back field by field. */
export function parseStoredFilters(
  value: unknown,
  availableTypes?: readonly string[],
): { query: string; type: StoredFundSourceType } {
  const parsed = fundSourceFiltersSchema.safeParse(value);
  if (parsed.success) {
    return {
      query: parsed.data.query,
      type: parseStoredTypeFilter(parsed.data.type, availableTypes),
    };
  }
  const raw = (value ?? {}) as Record<string, unknown>;
  return {
    query: typeof raw["query"] === "string" ? raw["query"].slice(0, 40) : "",
    type: parseStoredTypeFilter(raw["type"], availableTypes),
  };
}

export type FundSourceTypeFilter = "all" | string;

export type FundSourceFilters = {
  query: string;
  type: FundSourceTypeFilter;
};

export type FilterableWallet = {
  id: string;
  name: string;
  type: string;
};

export const matchesFilters = (w: FilterableWallet, filters: FundSourceFilters): boolean => {
  const q = filters.query.trim().toLowerCase();
  if (filters.type !== "all" && w.type !== filters.type) return false;
  if (q && !w.name.toLowerCase().includes(q)) return false;
  return true;
};

/** Applies filters without mutating the input array. */
export function filterWallets<T extends FilterableWallet>(
  wallets: readonly T[],
  filters: FundSourceFilters,
): T[] {
  return wallets.filter((w) => matchesFilters(w, filters));
}

export type SanitizeResult = {
  filters: FundSourceFilters;
  /** True when at least one stored filter value had to be discarded. */
  changed: boolean;
  /** Which filters were discarded, for precise announcements. */
  reasons: Array<"type" | "query">;
};

/**
 * Validates persisted filters against the wallets that are actually loaded.
 *
 * - A type filter that matches no wallet is reset to "all".
 * - A query that matches no wallet (after the type check) is cleared.
 *
 * Idempotent: calling it with already-valid filters returns them unchanged,
 * so it is safe to run on every render/hydration pass without a one-shot ref.
 */
export function sanitizeFilters(
  wallets: readonly FilterableWallet[],
  filters: FundSourceFilters,
): SanitizeResult {
  const reasons: SanitizeResult["reasons"] = [];
  let type = filters.type;
  let query = filters.query;

  if (wallets.length === 0) {
    return { filters: { type, query }, changed: false, reasons };
  }

  if (type !== "all" && !wallets.some((w) => w.type === type)) {
    type = "all";
    reasons.push("type");
  }

  if (query.trim() && filterWallets(wallets, { type, query }).length === 0) {
    query = "";
    reasons.push("query");
  }

  return { filters: { type, query }, changed: reasons.length > 0, reasons };
}
