import {
  test,
  expect,
  EMPTY_STATE,
  MANY_CATEGORIES_STATE,
  activate,
  openCategorySheet,
  openWhenHydrated,
} from "./fixtures";
import type { Page } from "@playwright/test";

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

/**
 * Visual baselines beyond the "no results" case: a fully populated list, the
 * collapsed preview and the truly empty list. Refresh with `bun run e2e:update`.
 */
test.describe("Kategori Transaksi — visual states", () => {
  test.describe("populated", () => {
    test.use({ seed: MANY_CATEGORIES_STATE });

    test("matches the expanded and collapsed baselines", async ({ page }) => {
      const sheet = await openSheet(page);
      const rows = page.locator('[data-testid^="category-item-"]');

      await expect(rows).toHaveCount(5);
      await expect(sheet).toHaveScreenshot("category-list-expanded.png");

      await activate(page.getByTestId("category-toggle-all"));
      await expect(rows).toHaveCount(3);
      await expect(page.getByTestId("category-collapsed-notice")).toHaveText("3/5");
      await expect(sheet).toHaveScreenshot("category-list-collapsed.png");
    });

    test("matches the single-Jenis filtered baseline", async ({ page }) => {
      const sheet = await openSheet(page);
      await page.getByTestId("category-filter-type").selectOption("income");
      await expect(page.locator('[data-testid^="category-item-"]')).toHaveCount(2);
      await expect(sheet).toHaveScreenshot("category-list-income.png");
    });
  });

  test.describe("no categories yet", () => {
    test.use({ seed: EMPTY_STATE });

    test("matches the empty-list baseline", async ({ page }) => {
      const sheet = await openSheet(page);
      await expect(page.getByTestId("category-empty")).toBeVisible();
      await expect(page.getByTestId("category-empty-reset")).toHaveCount(0);
      await expect(sheet).toHaveScreenshot("category-list-empty.png");
    });
  });
});

/**
 * Extra baselines requested for the filter highlight: a fully populated list
 * and the collapsed preview, both with an active selection highlighted
 * (search focus / selected Jenis option). Refresh with `bun run e2e:update`.
 */
test.describe("Kategori Transaksi — active selection highlight", () => {
  test.use({ seed: MANY_CATEGORIES_STATE });

  test("matches the filled list baseline with the active Jenis highlighted", async ({ page }) => {
    const sheet = await openSheet(page);
    const rows = page.locator('[data-testid^="category-item-"]');

    await expect(rows).toHaveCount(5);
    await page.getByTestId("category-filter-type").focus();
    await expect(page.getByTestId("category-filter-type")).toHaveValue("all");
    await expect(sheet).toHaveScreenshot("category-list-filled-active.png");
  });

  test("matches the collapsed baseline with the highlighted show-all control", async ({ page }) => {
    const sheet = await openSheet(page);
    const rows = page.locator('[data-testid^="category-item-"]');

    await activate(page.getByTestId("category-toggle-all"));
    await expect(rows).toHaveCount(3);
    const toggle = page.getByTestId("category-toggle-all");
    await expect(toggle).toHaveText("Tampilkan semua (5)");
    await toggle.focus();
    await expect(sheet).toHaveScreenshot("category-list-collapsed-active.png");
  });
});
