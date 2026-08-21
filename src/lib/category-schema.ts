/**
 * Strict input schema for every field of the "Kategori Transaksi" settings
 * surface. Every value that can reach app state — create form, inline rename,
 * search box, type filter, sort — is parsed here first, so invalid or hostile
 * input can never land in state.
 *
 * Sanitation rules are intentionally boring and total:
 * - strings are coerced from unknown, trimmed and whitespace-collapsed,
 * - control characters are stripped (paste from PDFs / spreadsheets),
 * - enums fall back to their safe default instead of throwing at the UI edge.
 */
import { z } from "zod";

export const CATEGORY_NAME_MIN = 2;
export const CATEGORY_NAME_MAX = 24;
export const CATEGORY_QUERY_MAX = 40;

// Control characters are matched deliberately: they are stripped from user input.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/g;

/** Trim, collapse inner whitespace and drop control characters. */
export function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim();
}

export const txTypeSchema = z.enum(["income", "expense"]);
export const categoryTypeFilterSchema = z.enum(["all", "income", "expense"]);
export const categorySortSchema = z.enum(["name-asc", "name-desc", "most-used"]);

export type TxTypeInput = z.infer<typeof txTypeSchema>;
export type CategoryTypeFilter = z.infer<typeof categoryTypeFilterSchema>;
export type CategorySortValue = z.infer<typeof categorySortSchema>;

export const categoryNameSchema = z
  .unknown()
  .transform(cleanText)
  .pipe(
    z
      .string()
      .min(CATEGORY_NAME_MIN, { message: "too-short" })
      .max(CATEGORY_NAME_MAX, { message: "too-long" })
      // Letters, digits, spaces and a few safe separators only: blocks markup,
      // quotes and emoji-only names that break list layout.
      .regex(/^[\p{L}\p{N}][\p{L}\p{N} .,&/'-]*$/u, { message: "invalid-characters" }),
  );

export const categoryQuerySchema = z
  .unknown()
  .transform((value) => (typeof value === "string" ? value.replace(CONTROL_CHARS, "") : ""))
  .pipe(z.string().max(CATEGORY_QUERY_MAX));

export const walletIdSchema = z
  .unknown()
  .transform((value) => (typeof value === "string" ? value.trim() : ""))
  .pipe(
    z
      .string()
      .max(64)
      .regex(/^[A-Za-z0-9_-]*$/, { message: "invalid-wallet" }),
  );

export const categoryInputSchema = z.object({
  name: categoryNameSchema,
  type: txTypeSchema,
  walletId: walletIdSchema.optional().default(""),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;

/** Parse a create/rename payload; returns null when the input is invalid. */
export function parseCategoryInput(input: unknown): CategoryInput | null {
  const parsed = categoryInputSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/** Parse a category name on its own (inline rename); null when invalid. */
export function parseCategoryName(value: unknown): string | null {
  const parsed = categoryNameSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Guarded coercions for the filter controls — never throw, always narrow. */
export function toCategoryQuery(value: unknown): string {
  const parsed = categoryQuerySchema.safeParse(value);
  return parsed.success ? parsed.data : "";
}

export function toCategoryTypeFilter(value: unknown): CategoryTypeFilter {
  const parsed = categoryTypeFilterSchema.safeParse(value);
  return parsed.success ? parsed.data : "all";
}

export function toCategorySort(value: unknown): CategorySortValue {
  const parsed = categorySortSchema.safeParse(value);
  return parsed.success ? parsed.data : "name-asc";
}

export const isCategoryTypeFilterValue = (value: unknown): value is CategoryTypeFilter =>
  categoryTypeFilterSchema.safeParse(value).success;
