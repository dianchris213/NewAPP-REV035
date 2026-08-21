/**
 * Pure filter logic for transaction categories ("Kategori Transaksi").
 *
 * Root cause of the reported bug ("3 categories exist, filtering by
 * Pengeluaran shows none, Pemasukan shows 1, Semua shows 2"): the category
 * list reused the fund-source filter, which compares `type` by strict string
 * equality and assumes ids are unique. Categories persisted by older versions
 * of the app (or edited by hand in storage) can carry Indonesian / legacy type
 * values ("Pemasukan", "masuk", "in", "EXPENSE") and duplicated ids, so rows
 * silently disappeared from every view.
 *
 * The fix is total normalization: every category type is mapped onto the
 * canonical `income` / `expense` pair before any comparison, ids are
 * de-duplicated, and the filter never throws on malformed rows.
 */

import type { CategoryTypeFilter, TxTypeInput } from "./category-schema";
import { cleanText } from "./category-schema";

export type FilterableCategory = {
  id: string;
  name: string;
  type: string;
  walletId?: string;
};

export type CategoryFilters = {
  query: string;
  type: CategoryTypeFilter;
};

const INCOME_ALIASES = new Set(["income", "pemasukan", "masuk", "in", "credit", "kredit"]);
const EXPENSE_ALIASES = new Set(["expense", "pengeluaran", "keluar", "out", "debit", "spend"]);

/**
 * Map any stored type value onto the canonical pair.
 * Unknown values fall back to "expense" — the app's default creation tab — so
 * a malformed row is still reachable in the UI and can be renamed or deleted.
 */
export function normalizeCategoryType(value: unknown): TxTypeInput {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (INCOME_ALIASES.has(raw)) return "income";
  if (EXPENSE_ALIASES.has(raw)) return "expense";
  return "expense";
}

/** Normalize a single row: canonical type, clean name, string id. */
export function normalizeCategory<T extends FilterableCategory>(category: T): T {
  const name = cleanText(category.name);
  return {
    ...category,
    id: typeof category.id === "string" ? category.id : String(category.id ?? ""),
    name,
    type: normalizeCategoryType(category.type),
  };
}

/**
 * Normalize a whole list and drop rows that cannot be rendered safely:
 * empty ids/names and duplicate ids (duplicate React keys previously made one
 * of the rows vanish from the list).
 */
export function normalizeCategories<T extends FilterableCategory>(
  categories: readonly unknown[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const raw of categories) {
    if (!raw || typeof raw !== "object") continue;
    const row = normalizeCategory(raw as T);
    if (!row.id || !row.name) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

export function matchesCategoryFilters(
  category: FilterableCategory,
  filters: CategoryFilters,
): boolean {
  const type = normalizeCategoryType(category.type);
  if (filters.type !== "all" && type !== filters.type) return false;
  const q = cleanText(filters.query).toLowerCase();
  if (q && !cleanText(category.name).toLowerCase().includes(q)) return false;
  return true;
}

/** Applies the filters without mutating the input array. */
export function filterCategories<T extends FilterableCategory>(
  categories: readonly T[],
  filters: CategoryFilters,
): T[] {
  return categories.filter((c) => matchesCategoryFilters(c, filters));
}

export type SanitizeCategoryResult = {
  filters: CategoryFilters;
  changed: boolean;
  reasons: Array<"type" | "query">;
};

/**
 * Validates *restored* filters against the categories actually loaded.
 * A stored type filter that no category can satisfy, or a stored query that
 * matches nothing, is reset instead of showing a misleading empty state.
 * Idempotent: valid filters are returned unchanged.
 */
export function sanitizeCategoryFilters(
  categories: readonly FilterableCategory[],
  filters: CategoryFilters,
): SanitizeCategoryResult {
  const reasons: SanitizeCategoryResult["reasons"] = [];
  let type = filters.type;
  let query = filters.query;

  if (categories.length === 0) {
    return { filters: { type, query }, changed: false, reasons };
  }

  if (type !== "all" && !categories.some((c) => normalizeCategoryType(c.type) === type)) {
    type = "all";
    reasons.push("type");
  }

  if (cleanText(query) && filterCategories(categories, { type, query }).length === 0) {
    query = "";
    reasons.push("query");
  }

  return { filters: { type, query }, changed: reasons.length > 0, reasons };
}

export type CategoryTypeCounts = { all: number; income: number; expense: number };

/**
 * Count categories per canonical Jenis so the filter control can advertise how
 * many rows each option yields (e.g. "Pengeluaran (5)"). Counts respect the
 * active search query so the numbers always match the rendered list.
 */
export function countCategoriesByType(
  categories: readonly FilterableCategory[],
  query = "",
): CategoryTypeCounts {
  const counts: CategoryTypeCounts = { all: 0, income: 0, expense: 0 };
  const q = cleanText(query).toLowerCase();
  for (const category of categories) {
    if (q && !cleanText(category.name).toLowerCase().includes(q)) continue;
    counts.all += 1;
    counts[normalizeCategoryType(category.type)] += 1;
  }
  return counts;
}
