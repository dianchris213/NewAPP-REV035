import {
  test,
  expect,
  MANY_CATEGORIES_STATE,
  activate,
  openCategorySheet,
  openWhenHydrated,
} from "./fixtures";
import type { Page } from "@playwright/test";

test.use({ seed: MANY_CATEGORIES_STATE });

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
 * "Tampilkan semua (N)" is a user preference, so it must survive navigating to
 * another page and coming back — and a reload.
 */
test.describe("Kategori Transaksi — collapse choice survives navigation", () => {
  test("shows all 5 rows by default", async ({ page }) => {
    await openSheet(page);
    await expect(page.locator('[data-testid^="category-item-"]')).toHaveCount(5);
    await expect(page.getByTestId("category-toggle-all")).toHaveAttribute("aria-expanded", "true");
  });

  test("keeps the collapsed state after leaving and returning", async ({ page }) => {
    await openSheet(page);
    const rows = page.locator('[data-testid^="category-item-"]');

    await activate(page.getByTestId("category-toggle-all"));
    await expect(rows).toHaveCount(3);

    await page.goto("/analytics", { waitUntil: "domcontentloaded" });
    await openSheet(page);
    await expect(rows).toHaveCount(3);
    await expect(page.getByTestId("category-toggle-all")).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("category-collapsed-notice")).toHaveText("3/5");
  });

  test("keeps the expanded state after a reload", async ({ page }) => {
    await openSheet(page);
    const rows = page.locator('[data-testid^="category-item-"]');

    await activate(page.getByTestId("category-toggle-all"));
    await expect(rows).toHaveCount(3);
    await activate(page.getByTestId("category-toggle-all"));
    await expect(rows).toHaveCount(5);

    await page.reload({ waitUntil: "domcontentloaded" });
    await openSheet(page);
    await expect(rows).toHaveCount(5);
    await expect(page.getByTestId("category-toggle-all")).toHaveAttribute("aria-expanded", "true");
  });
});
