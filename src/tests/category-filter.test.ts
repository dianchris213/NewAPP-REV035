import { describe, expect, it } from "vitest";
import {
  countCategoriesByType,
  filterCategories,
  normalizeCategories,
  normalizeCategoryType,
  sanitizeCategoryFilters,
  type FilterableCategory,
} from "@/lib/category-filter";

const cat = (id: string, name: string, type: string): FilterableCategory => ({ id, name, type });

/** 3 Pemasukan + 5 Pengeluaran: the exact shape the user reported as broken. */
const dataset: FilterableCategory[] = [
  cat("i1", "Gaji", "income"),
  cat("i2", "Bonus", "Pemasukan"),
  cat("i3", "Dividen", "masuk"),
  cat("e1", "Makan", "expense"),
  cat("e2", "Transport", "Pengeluaran"),
  cat("e3", "Listrik", "keluar"),
  cat("e4", "Internet", "debit"),
  cat("e5", "Kopi", "EXPENSE"),
];

describe("normalizeCategoryType", () => {
  it("maps every known alias to a canonical type", () => {
    for (const value of ["income", "Pemasukan", " MASUK ", "credit", "kredit", "in"]) {
      expect(normalizeCategoryType(value)).toBe("income");
    }
    for (const value of ["expense", "Pengeluaran", "keluar", "debit", "spend", "out"]) {
      expect(normalizeCategoryType(value)).toBe("expense");
    }
  });

  it("falls back to expense for unknown or non-string values", () => {
    expect(normalizeCategoryType("unknown")).toBe("expense");
    expect(normalizeCategoryType(undefined)).toBe("expense");
    expect(normalizeCategoryType(42)).toBe("expense");
  });
});

describe("filterCategories", () => {
  it("returns every category of the selected Jenis", () => {
    expect(filterCategories(dataset, { query: "", type: "income" })).toHaveLength(3);
    expect(filterCategories(dataset, { query: "", type: "expense" })).toHaveLength(5);
    expect(filterCategories(dataset, { query: "", type: "all" })).toHaveLength(8);
  });

  it("combines the search query with the Jenis filter", () => {
    expect(filterCategories(dataset, { query: "ko", type: "expense" }).map((c) => c.name)).toEqual([
      "Kopi",
    ]);
    expect(filterCategories(dataset, { query: "ko", type: "income" })).toHaveLength(0);
  });

  it("ignores case and surrounding whitespace in the query", () => {
    expect(filterCategories(dataset, { query: "  gAJi ", type: "all" })).toHaveLength(1);
  });

  it("never drops rows when no filter is active", () => {
    expect(filterCategories(dataset, { query: "", type: "all" }).map((c) => c.id)).toEqual(
      dataset.map((c) => c.id),
    );
  });
});

describe("countCategoriesByType", () => {
  it("counts per canonical Jenis", () => {
    expect(countCategoriesByType(dataset)).toEqual({ all: 8, income: 3, expense: 5 });
  });

  it("respects the active search query so counts match the list", () => {
    const counts = countCategoriesByType(dataset, "o");
    const rows = filterCategories(dataset, { query: "o", type: "all" });
    expect(counts.all).toBe(rows.length);
    expect(counts.income + counts.expense).toBe(counts.all);
  });
});

describe("normalizeCategories", () => {
  it("drops invalid rows, dedupes ids and canonicalizes types", () => {
    const rows = normalizeCategories<FilterableCategory>([
      cat("a", "Gaji", "Pemasukan"),
      cat("a", "Gaji duplikat", "income"),
      cat("b", "  Makan  ", "Pengeluaran"),
      cat("", "Tanpa id", "income"),
      { id: "c", name: "", type: "income" },
      null,
      "nope",
    ]);
    expect(rows.map((r) => [r.id, r.name, r.type])).toEqual([
      ["a", "Gaji", "income"],
      ["b", "Makan", "expense"],
    ]);
  });
});

describe("sanitizeCategoryFilters", () => {
  it("keeps a filter that still matches data", () => {
    const result = sanitizeCategoryFilters(dataset, { query: "", type: "expense" });
    expect(result.changed).toBe(false);
    expect(result.filters).toEqual({ query: "", type: "expense" });
  });

  it("resets a stored Jenis that hides every category", () => {
    const incomeOnly = dataset.filter((c) => normalizeCategoryType(c.type) === "income");
    const result = sanitizeCategoryFilters(incomeOnly, { query: "", type: "expense" });
    expect(result.filters.type).toBe("all");
    expect(result.reasons).toContain("type");
  });

  it("resets a stored query with no matches", () => {
    const result = sanitizeCategoryFilters(dataset, { query: "zzz", type: "all" });
    expect(result.filters.query).toBe("");
    expect(result.reasons).toContain("query");
  });

  it("leaves filters untouched when there is no data yet", () => {
    const result = sanitizeCategoryFilters([], { query: "zzz", type: "income" });
    expect(result.changed).toBe(false);
  });
});
