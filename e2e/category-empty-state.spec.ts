import { test, expect, openCategorySheet } from "./fixtures";

/**
 * Visual regression for the empty state of Kategori Transaksi.
 * Refresh the baseline on purpose with `bun run e2e:update`.
 */
test.describe("Kategori Transaksi — empty state", () => {
  test("matches the empty-state baseline", async ({ page }) => {
    const { row, sheet } = await openCategorySheet(page);
    await expect(async () => {
      await row.click();
      await expect(sheet).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await expect(sheet.getByRole("heading", { level: 3 })).toBeVisible();
    await expect(sheet).toHaveScreenshot("category-empty-state.png");
  });
});
