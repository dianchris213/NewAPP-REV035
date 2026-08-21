import {
  test,
  expect,
  MANY_CATEGORIES_STATE,
  activate,
  openCategorySheet,
  openWhenHydrated,
  waitForClickTarget,
} from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * Focus/hover baselines for the *active* filter selection and for the summary
 * row. These states are where highlight regressions hide: a lost focus ring or
 * a hover fill that no longer distinguishes the active category is invisible to
 * DOM assertions but obvious in a pixel diff. Tolerance is deliberately tight
 * (see playwright.config.ts) so a thin ring still fails.
 * Refresh with `bun run e2e:update`.
 */
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

test.describe("Kategori Transaksi — focus/hover on the active selection", () => {
  test("active Jenis keeps its highlight while focused", async ({ page }) => {
    const sheet = await openSheet(page);
    const filter = page.getByTestId("category-filter-type");

    await filter.selectOption("income");
    await expect(page.locator('[data-testid^="category-item-"]')).toHaveCount(2);
    await filter.focus();
    await expect(filter).toBeFocused();
    await expect(sheet).toHaveScreenshot("category-active-jenis-focus.png");
  });

  test("active Jenis keeps its highlight while hovered", async ({ page }) => {
    const sheet = await openSheet(page);
    const filter = page.getByTestId("category-filter-type");

    await filter.selectOption("expense");
    await expect(page.locator('[data-testid^="category-item-"]')).toHaveCount(3);
    await waitForClickTarget(filter);
    await filter.hover();
    await expect(sheet).toHaveScreenshot("category-active-jenis-hover.png");
  });

  test("first category row of the active filter shows its hover state", async ({ page }) => {
    const sheet = await openSheet(page);
    await page.getByTestId("category-filter-type").selectOption("income");
    const firstRow = page.locator('[data-testid^="category-item-"]').first();

    await waitForClickTarget(firstRow);
    await firstRow.hover();
    await expect(sheet).toHaveScreenshot("category-active-row-hover.png");
  });

  test("collapse toggle shows its focus ring while collapsed", async ({ page }) => {
    const sheet = await openSheet(page);
    const toggle = page.getByTestId("category-toggle-all");

    await activate(toggle);
    await expect(page.locator('[data-testid^="category-item-"]')).toHaveCount(3);
    await toggle.focus();
    await expect(toggle).toBeFocused();
    await expect(sheet).toHaveScreenshot("category-toggle-focus.png");
  });
});

/** Summary/rekap item states inside Tagihan Bulanan (Pengaturan → Data). */
test.describe("Tagihan Bulanan — summary item focus/hover", () => {
  async function openBilling(page: Page) {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    const row = page.getByRole("button", { name: /tagihan bulanan/i }).first();
    const sheet = page.getByTestId("billing-sheet");
    await openWhenHydrated(
      () => row.click(),
      async () => {
        await expect(sheet).toBeVisible({ timeout: 1_000 });
      },
    );
    return sheet;
  }

  test("summary item highlights on focus and on hover", async ({ page }) => {
    await openBilling(page);
    const summary = page.getByTestId("billing-summary");
    const item = page.getByTestId("billing-summary-outstanding");

    await item.focus();
    await expect(summary).toHaveScreenshot("billing-summary-focus.png");

    await item.hover();
    await expect(summary).toHaveScreenshot("billing-summary-hover.png");
  });
});
