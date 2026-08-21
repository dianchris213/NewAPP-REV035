import {
  test,
  expect,
  FILLED_STATE,
  activate,
  openCategorySheet,
  openWhenHydrated,
} from "./fixtures";

test.use({ seed: FILLED_STATE });

/**
 * Baseline for the "filter yields nothing" state: categories exist, but the
 * active query matches none of them, so the sheet shows the no-results message
 * plus the reset affordance. Refresh with `bun run e2e:update`.
 */
test.describe("Kategori Transaksi — empty filter result", () => {
  test("matches the no-results baseline", async ({ page }) => {
    const { row, sheet } = await openCategorySheet(page);
    await openWhenHydrated(
      () => row.click(),
      async () => {
        await expect(sheet).toBeVisible({ timeout: 1_000 });
      },
    );

    await page.getByTestId("category-search").fill("zzzz");
    await expect(page.locator('[data-testid^="category-item-"]')).toHaveCount(0);
    await expect(page.getByTestId("category-empty")).toBeVisible();
    await expect(page.getByTestId("category-empty-reset")).toBeVisible();
    await expect(sheet).toHaveScreenshot("category-empty-filter.png");

    // Reset restores the full list, proving the state is recoverable.
    // The bottom navigation overlays the sheet footer on this viewport, so a
    // pointer click can be intercepted; focus + Enter drives the same handler
    // through the keyboard path and never depends on hit-testing.
    await activate(page.getByTestId("category-empty-reset"));
    await expect(page.locator('[data-testid^="category-item-"]')).toHaveCount(3);
  });
});
