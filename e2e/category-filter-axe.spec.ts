import {
  test,
  expect,
  EMPTY_STATE,
  MANY_CATEGORIES_STATE,
  openCategorySheet,
  openWhenHydrated,
} from "./fixtures";
import { analyzeA11y } from "./a11y";
import type { Page } from "@playwright/test";

/**
 * axe-core audits for the category filter surface: labels/roles of the filter
 * controls, the empty and "no results" states, and the Tab / Shift+Tab focus
 * order. A violation fails the test with the offending selectors printed.
 */
async function openSheet(page: Page) {
  const { row, sheet } = await openCategorySheet(page);
  await openWhenHydrated(
    () => row.click(),
    async () => {
      await expect(sheet).toBeVisible({ timeout: 1_000 });
    },
  );
  return sheet;
}

const activeTestId = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset["testid"] ?? "");

const FILTER_ORDER = ["category-search", "category-filter-type", "category-sort"] as const;

test.describe("Kategori Transaksi — axe audits", () => {
  test.describe("with categories", () => {
    test.use({ seed: MANY_CATEGORIES_STATE });

    test("filter controls expose valid ARIA labels and roles", async ({ page }) => {
      await openSheet(page);

      await expect(page.getByRole("searchbox", { name: /cari/i })).toBeVisible();
      await expect(page.getByRole("combobox", { name: /jenis/i })).toBeVisible();
      await expect(page.getByRole("combobox", { name: /urut/i })).toBeVisible();

      const violations = await analyzeA11y(page, '[data-testid="category-sheet"]');
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });

    test("the no-results state is accessible", async ({ page }) => {
      await openSheet(page);
      await page.getByTestId("category-search").fill("zzzzz-tidak-ada");
      await expect(page.locator('[data-testid^="category-item-"]')).toHaveCount(0);
      await expect(page.getByTestId("category-empty")).toBeVisible();

      const violations = await analyzeA11y(page, '[data-testid="category-sheet"]');
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });

    test("Tab / Shift+Tab focus order raises no violations", async ({ page }) => {
      await openSheet(page);
      await page.getByTestId("category-search").focus();

      for (const id of FILTER_ORDER.slice(1)) {
        await page.keyboard.press("Tab");
        expect(await activeTestId(page)).toBe(id);
      }
      for (const id of [...FILTER_ORDER].reverse().slice(1)) {
        await page.keyboard.press("Shift+Tab");
        expect(await activeTestId(page)).toBe(id);
      }
      expect(await activeTestId(page)).toBe("category-search");

      const violations = await analyzeA11y(page, '[data-testid="category-sheet"]');
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  });

  test.describe("without categories", () => {
    test.use({ seed: EMPTY_STATE });

    test("the empty state is accessible", async ({ page }) => {
      await openSheet(page);
      await expect(page.getByTestId("category-empty")).toBeVisible();

      const violations = await analyzeA11y(page, '[data-testid="category-sheet"]');
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  });
});
