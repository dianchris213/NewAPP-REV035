import { test, expect, FILLED_STATE, openWhenHydrated } from "./fixtures";
import type { Page } from "@playwright/test";

test.use({ seed: FILLED_STATE });

const activeInfo = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return {
      inDialog: !!el?.closest('[data-testid="fullscreen-modal"]'),
      label: (el?.getAttribute("aria-label") ?? el?.textContent ?? "").trim().slice(0, 40),
    };
  });

async function openPocketWithEnter(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const trigger = page.getByTestId("pocket-trigger-Dompet Utama");
  await expect(trigger).toBeVisible();
  const dialog = page.getByTestId("fullscreen-modal");
  await openWhenHydrated(
    async () => {
      await trigger.focus();
      await page.keyboard.press("Enter");
    },
    async () => {
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    },
  );
  return { trigger, dialog };
}

test.describe("Kantong Dana dialog — keyboard", () => {
  test("Enter opens the dialog and moves focus inside it", async ({ page }) => {
    await openPocketWithEnter(page);
    await expect.poll(async () => (await activeInfo(page)).inDialog).toBe(true);
  });

  test("Tab and Shift+Tab stay trapped inside the dialog", async ({ page }) => {
    await openPocketWithEnter(page);
    await expect.poll(async () => (await activeInfo(page)).inDialog).toBe(true);

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      expect((await activeInfo(page)).inDialog, `focus escaped forward at step ${i}`).toBe(true);
    }
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Shift+Tab");
      expect((await activeInfo(page)).inDialog, `focus escaped backward at step ${i}`).toBe(true);
    }
  });

  test("Escape closes the dialog and returns focus to the pocket trigger", async ({ page }) => {
    const { dialog } = await openPocketWithEnter(page);
    await expect.poll(async () => (await activeInfo(page)).inDialog).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await activeInfo(page)).label).toMatch(/kantong dompet utama/i);
  });
});
