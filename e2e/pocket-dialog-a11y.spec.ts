import { test, expect, FILLED_STATE, openWhenHydrated } from "./fixtures";
import { analyzeA11y } from "./a11y";

test.use({ seed: FILLED_STATE });

test.describe("Kantong Dana dialog — accessibility", () => {
  test("has no axe violations and exposes a correct dialog role/label", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const trigger = page.getByTestId("pocket-trigger-Dompet Utama");
    const dialog = page.getByTestId("fullscreen-modal");

    await openWhenHydrated(
      () => trigger.click(),
      async () => {
        await expect(dialog).toBeVisible({ timeout: 1_000 });
      },
    );

    // Role, modality and accessible name must be present for screen readers.
    await expect(dialog).toHaveAttribute("role", "dialog");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    const name = await dialog.getAttribute("aria-label");
    expect(name?.trim()).toBeTruthy();

    // Focus management: focus is inside the dialog and the close control is reachable.
    await expect
      .poll(() =>
        page.evaluate(() => !!document.activeElement?.closest('[data-testid="fullscreen-modal"]')),
      )
      .toBe(true);
    await expect(page.getByTestId("fullscreen-modal-close")).toBeVisible();

    const violations = await analyzeA11y(page, '[data-testid="fullscreen-modal"]');
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
