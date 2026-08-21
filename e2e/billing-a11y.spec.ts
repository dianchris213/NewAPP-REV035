import type { Page } from "@playwright/test";
import { test, expect, EMPTY_STATE, openWhenHydrated } from "./fixtures";
import { analyzeA11y } from "./a11y";

/** axe audit + focus order for the Tagihan Bulanan sheet (Pengaturan → Data). */
test.use({ seed: EMPTY_STATE });

/**
 * Designed focus order of the sheet form. The icon picker is a radiogroup, so
 * it is a single Tab stop (roving tabindex); arrows move inside it.
 */
const FORM_ORDER = [
  "billing-name",
  "billing-icon-receipt_long",
  "billing-amount",
  "billing-due-date",
  "billing-due-date-toggle",

  "billing-recurring",
  "billing-tax",
  "billing-discount-mode",
  "billing-discount-value",
  "billing-phone",
  "billing-note",
  "billing-submit",
] as const;

async function activeTestId(page: Page): Promise<string> {
  return page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.dataset["testid"] ?? "",
  );
}

/**
 * Presses Tab (or Shift+Tab) until the focused control changes.
 * `<input type="date">` exposes internal day/month/year segments that consume
 * Tab without moving `document.activeElement`, so a single press is not enough
 * — this keeps the assertion about the control order, not about key counts.
 */
async function tabToNextControl(page: Page, back = false): Promise<string> {
  const from = await activeTestId(page);
  for (let press = 0; press < 6; press += 1) {
    await page.keyboard.press(back ? "Shift+Tab" : "Tab");
    const now = await activeTestId(page);
    if (now !== from) return now;
  }
  return from;
}


async function openSheet(page: Page) {
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
  // Wait for hydration of the icon group before driving the keyboard, so the
  // roving tabindex is already applied (removes the historic flakiness here).
  await expect(page.getByTestId("billing-icon-group")).toBeVisible();
  await expect(page.getByTestId("billing-icon-receipt_long")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  return sheet;
}

test.describe("Tagihan Bulanan — accessibility", () => {
  test("the sheet, its form and its summary raise no axe violations", async ({ page }) => {
    await openSheet(page);

    await expect(page.getByTestId("billing-summary")).toBeVisible();
    await expect(page.getByTestId("billing-empty")).toBeVisible();

    const violations = await analyzeA11y(page, '[data-testid="billing-sheet"]');
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test("Tab follows the designed order and the icon group is one stop", async ({ page }) => {
    await openSheet(page);
    await page.getByTestId("billing-name").focus();
    expect(await activeTestId(page)).toBe(FORM_ORDER[0]);

    for (const id of FORM_ORDER.slice(1)) {
      expect(await tabToNextControl(page), `expected focus on ${id}`).toBe(id);
    }
  });

  test("Shift+Tab walks the same order backwards", async ({ page }) => {
    await openSheet(page);
    await page.getByTestId("billing-submit").focus();
    expect(await activeTestId(page)).toBe("billing-submit");

    const reverse = [...FORM_ORDER].reverse().slice(1);
    for (const id of reverse) {
      expect(await tabToNextControl(page, true), `expected focus back on ${id}`).toBe(id);
    }
  });


  test("the icon radiogroup toggles with arrows, Home/End and Space", async ({ page }) => {
    await openSheet(page);
    const active = page.getByTestId("billing-icon-receipt_long");
    const first = page.getByTestId("billing-icon-wifi");
    const last = page.getByTestId("billing-icon-receipt_long");

    await active.focus();
    await expect(active).toBeFocused();

    // Poll the first arrow press: on a cold, still-hydrating sheet the very
    // first keydown can land before React attached its handler.
    await expect(async () => {
      await page.keyboard.press("ArrowRight"); // wraps to the first option
      await expect(first).toHaveAttribute("aria-checked", "true", { timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await expect(first).toBeFocused();
    await expect(active).toHaveAttribute("aria-checked", "false");


    await page.keyboard.press("ArrowLeft"); // wraps back to the last option
    await expect(last).toHaveAttribute("aria-checked", "true");
    await expect(last).toBeFocused();

    await page.keyboard.press("Home");
    await expect(first).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("End");
    await expect(last).toHaveAttribute("aria-checked", "true");

    // Space re-affirms the focused option without moving focus.
    await page.keyboard.press("Space");
    await expect(last).toHaveAttribute("aria-checked", "true");
    await expect(last).toBeFocused();

    // Exactly one tab stop inside the group at any time.
    const stops = await page
      .locator('[data-testid="billing-icon-group"] [role="radio"][tabindex="0"]')
      .count();
    expect(stops).toBe(1);
  });

  test("Tab from the icon group leaves the group entirely", async ({ page }) => {
    await openSheet(page);
    await page.getByTestId("billing-icon-receipt_long").focus();
    await page.keyboard.press("Tab");
    expect(await activeTestId(page)).toBe("billing-amount");
    await page.keyboard.press("Shift+Tab");
    expect(await activeTestId(page)).toBe("billing-icon-receipt_long");
  });
});
