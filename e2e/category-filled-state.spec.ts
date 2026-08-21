import { test, expect, FILLED_STATE, openCategorySheet, openWhenHydrated } from "./fixtures";

test.use({ seed: FILLED_STATE });

/**
 * Visual + behavioural regression for the populated Kategori Transaksi list
 * (2 Pemasukan, 1 Pengeluaran). Refresh the baseline with `bun run e2e:update`.
 */
test.describe("Kategori Transaksi — filled state", () => {
  test("matches the filled-state baseline", async ({ page }) => {
    const { row, sheet } = await openCategorySheet(page);
    await openWhenHydrated(
      () => row.click(),
      async () => {
        await expect(sheet).toBeVisible({ timeout: 1_000 });
      },
    );
    await expect(page.getByTestId("category-item-cat-income-1")).toBeVisible();
    await expect(page.locator('[data-testid^="category-item-"]')).toHaveCount(3);
    await expect(sheet).toHaveScreenshot("category-filled-state.png");
  });

  test("filtering by Jenis returns every matching category", async ({ page }) => {
    const { row, sheet } = await openCategorySheet(page);
    await openWhenHydrated(
      () => row.click(),
      async () => {
        await expect(sheet).toBeVisible({ timeout: 1_000 });
      },
    );
    const rows = page.locator('[data-testid^="category-item-"]');
    const typeFilter = page.getByTestId("category-filter-type");

    await typeFilter.selectOption("income");
    await expect(rows).toHaveCount(2);

    await typeFilter.selectOption("expense");
    await expect(rows).toHaveCount(1);
    await expect(page.getByTestId("category-item-cat-expense-1")).toBeVisible();

    await typeFilter.selectOption("all");
    await expect(rows).toHaveCount(3);
  });
});
