import { test, expect, openCategorySheet } from "./fixtures";
import type { Page } from "@playwright/test";

const activeInfo = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return {
      inSheet: !!el?.closest('[data-testid="category-sheet"]'),
      label: (el?.getAttribute("aria-label") ?? el?.textContent ?? "").trim().slice(0, 40),
    };
  });

async function openWithKeyboard(page: Page) {
  const { row, sheet } = await openCategorySheet(page);
  // Retry the keypress until hydration has attached the click handler.
  await expect(async () => {
    await row.focus();
    await page.keyboard.press("Enter");
    await expect(sheet).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  return sheet;
}

test.describe("Kategori Transaksi — keyboard navigation", () => {
  test("Enter opens the sheet and moves focus inside it", async ({ page }) => {
    await openWithKeyboard(page);
    await expect.poll(async () => (await activeInfo(page)).inSheet).toBe(true);
  });

  test("Tab and Shift+Tab stay trapped inside the sheet", async ({ page }) => {
    await openWithKeyboard(page);
    await expect.poll(async () => (await activeInfo(page)).inSheet).toBe(true);

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      expect((await activeInfo(page)).inSheet, `focus escaped forward at step ${i}`).toBe(true);
    }
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Shift+Tab");
      expect((await activeInfo(page)).inSheet, `focus escaped backward at step ${i}`).toBe(true);
    }
  });

  test("Tab order is stable and reversible", async ({ page }) => {
    await openWithKeyboard(page);
    await expect.poll(async () => (await activeInfo(page)).inSheet).toBe(true);

    const forward: string[] = [];
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      forward.push((await activeInfo(page)).label);
    }
    const backward: string[] = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Shift+Tab");
      backward.push((await activeInfo(page)).label);
    }
    expect(backward).toEqual(forward.slice(0, 4).reverse());
  });

  test("Escape closes the sheet and returns focus to the opener", async ({ page }) => {
    const sheet = await openWithKeyboard(page);
    await expect.poll(async () => (await activeInfo(page)).inSheet).toBe(true);
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect.poll(async () => (await activeInfo(page)).label).toMatch(/kategori/i);
  });
});
