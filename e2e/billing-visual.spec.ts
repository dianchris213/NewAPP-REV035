import { test, expect, EMPTY_STATE, openWhenHydrated } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * Visual regression baselines for BillingSheet + BillingCalendar.
 *
 * Thresholds are the documented project policy (playwright.config.ts):
 *   threshold 0.1 · maxDiffPixelRatio 0.005 · animations disabled · caret hidden
 * They are restated per-assertion so a global config change can never silently
 * loosen the billing baselines.
 *
 * Refresh intentionally-changed baselines with `bun run e2e:update:billing`.
 */
const SHOT = {
  threshold: 0.1,
  maxDiffPixelRatio: 0.005,
  animations: "disabled",
  caret: "hide",
} as const;

test.use({ seed: EMPTY_STATE });

async function openBillingSheet(page: Page) {
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  const sheet = page.getByTestId("billing-sheet");
  await openWhenHydrated(
    () =>
      page
        .getByRole("button", { name: /tagihan bulanan/i })
        .first()
        .click(),
    async () => {
      await expect(sheet).toBeVisible({ timeout: 1_000 });
    },
  );
  return sheet;
}

test.describe("Tagihan Bulanan — visual baselines", () => {
  test("BillingSheet default state matches its baseline", async ({ page }) => {
    const sheet = await openBillingSheet(page);
    await expect(page.getByTestId("billing-totals")).toBeVisible();
    await expect(page.getByTestId("billing-empty")).toBeVisible();
    await expect(sheet).toHaveScreenshot("billing-sheet-default.png", SHOT);
  });

  test("BillingSheet with a validation error matches its baseline", async ({ page }) => {
    const sheet = await openBillingSheet(page);
    const amount = page.getByTestId("billing-amount");
    await amount.fill("0");
    await amount.blur();
    await expect(page.getByTestId("billing-amount-error")).toBeVisible();
    await expect(sheet).toHaveScreenshot("billing-sheet-amount-error.png", SHOT);
  });

  test("BillingCalendar matches the idle and focused-day baselines", async ({ page }) => {
    await openBillingSheet(page);
    const calendar = page.getByTestId("billing-calendar");
    await expect(calendar).toBeVisible();
    await expect(calendar).toHaveScreenshot("billing-calendar-idle.png", SHOT);

    const selected = calendar.locator('button[data-day="selected"]');
    await selected.focus();
    await expect(selected).toBeFocused();
    await expect(calendar).toHaveScreenshot("billing-calendar-focused-day.png", SHOT);
  });
});
