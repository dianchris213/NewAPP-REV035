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

const rowsOf = (page: Page) => page.locator('[data-testid^="category-item-"]');

/**
 * The collapsed/expanded state and the "Tampilkan semua (N)" affordance are
 * user preferences persisted in local storage. They must stay consistent
 * across a hard reload (no bfcache, fresh hydration) and when returning from a
 * detail page through the browser Back button.
 */
test.describe("Kategori Transaksi — collapse state consistency", () => {
  test("collapsed state and the (N) count survive a hard reload", async ({ page }) => {
    await openSheet(page);
    const rows = rowsOf(page);
    await expect(rows).toHaveCount(5);

    await activate(page.getByTestId("category-toggle-all"));
    await expect(rows).toHaveCount(3);
    await expect(page.getByTestId("category-toggle-all")).toHaveText("Tampilkan semua (5)");

    // Hard reload: bypass the cache so the app hydrates from scratch.
    await page.evaluate(() => window.location.reload());
    await page.waitForLoadState("domcontentloaded");
    await openSheet(page);

    await expect(rows).toHaveCount(3);
    const toggle = page.getByTestId("category-toggle-all");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("data-state", "collapsed");
    await expect(toggle).toHaveText("Tampilkan semua (5)");
    await expect(page.getByTestId("category-collapsed-notice")).toHaveText("3/5");
  });

  test("expanded state and the toggle label survive a hard reload", async ({ page }) => {
    await openSheet(page);
    const rows = rowsOf(page);

    await activate(page.getByTestId("category-toggle-all"));
    await expect(rows).toHaveCount(3);
    await activate(page.getByTestId("category-toggle-all"));
    await expect(rows).toHaveCount(5);

    await page.evaluate(() => window.location.reload());
    await page.waitForLoadState("domcontentloaded");
    await openSheet(page);

    await expect(rows).toHaveCount(5);
    const toggle = page.getByTestId("category-toggle-all");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute("data-state", "expanded");
    await expect(toggle).toHaveText("Sembunyikan");
    await expect(page.getByTestId("category-collapsed-notice")).toHaveCount(0);
  });

  test("collapsed state is unchanged after visiting a detail page and going Back", async ({
    page,
  }) => {
    await openSheet(page);
    const rows = rowsOf(page);

    await activate(page.getByTestId("category-toggle-all"));
    await expect(rows).toHaveCount(3);

    // Detail page, then browser Back to Pengaturan.
    await page.goto("/wallet", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/wallet$/);
    await page.goBack({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/settings$/);
    await openSheet(page);

    await expect(rows).toHaveCount(3);
    const toggle = page.getByTestId("category-toggle-all");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveText("Tampilkan semua (5)");
    await expect(page.getByTestId("category-collapsed-notice")).toHaveText("3/5");
  });

  test("an active Jenis filter still overrides the stored collapsed state after reload", async ({
    page,
  }) => {
    await openSheet(page);
    const rows = rowsOf(page);

    await activate(page.getByTestId("category-toggle-all"));
    await expect(rows).toHaveCount(3);

    await page.getByTestId("category-filter-type").selectOption("expense");
    // Filtering bypasses the collapse: all 3 matching rows are shown and the
    // toggle disappears because the filtered list fits the preview.
    await expect(rows).toHaveCount(3);
    await expect(page.getByTestId("category-toggle-all")).toHaveCount(0);

    await page.evaluate(() => window.location.reload());
    await page.waitForLoadState("domcontentloaded");
    await openSheet(page);

    await expect(page.getByTestId("category-filter-type")).toHaveValue("expense");
    await expect(rows).toHaveCount(3);

    // Clearing the filter restores the persisted collapsed preview.
    await activate(page.getByTestId("category-reset-filter"));
    await expect(rows).toHaveCount(3);
    await expect(page.getByTestId("category-toggle-all")).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("category-collapsed-notice")).toHaveText("3/5");
  });
});
