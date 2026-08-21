import { test, expect, EMPTY_STATE, openWhenHydrated } from "./fixtures";
import { analyzeA11y } from "./a11y";
import { closePopover, expectActiveTestId, expectFocusWithin, openPopover } from "./focus-helpers";

/** Focus trap + scoped Escape behaviour of the due-date popover. */
test.use({ seed: EMPTY_STATE });

async function openSheet(page: import("@playwright/test").Page) {
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

test.describe("DueDatePicker — focus trap and scoped Escape", () => {
  test("Tab and Shift+Tab cycle inside the popover only", async ({ page }) => {
    await openSheet(page);
    const toggle = page.getByTestId("billing-due-date-toggle");
    const popover = page.getByTestId("billing-due-date-popover");
    await page.getByTestId("billing-due-date").fill("2026-08-21");

    await openPopover(page, () => toggle.click(), popover);
    await expectActiveTestId(page, "billing-due-day-2026-08-21");

    const seen: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      await expectFocusWithin(popover);
      seen.push(
        await page.evaluate(
          () => (document.activeElement as HTMLElement | null)?.dataset["testid"] ?? "",
        ),
      );
    }
    // Cycling means the trap wrapped back to an already-visited control.
    expect(new Set(seen).size).toBeLessThan(seen.length);
    expect(seen).toContain("billing-due-prev");
    expect(seen).toContain("billing-due-next");

    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press("Shift+Tab");
      await expectFocusWithin(popover);
    }

    const violations = await analyzeA11y(page, '[data-testid="billing-due-date-popover"]');
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test("Escape closes only the popover and restores focus to the toggle", async ({ page }) => {
    const sheet = await openSheet(page);
    const toggle = page.getByTestId("billing-due-date-toggle");
    const popover = page.getByTestId("billing-due-date-popover");

    await openPopover(page, () => toggle.click(), popover);
    await closePopover(page, () => page.keyboard.press("Escape"), popover, toggle);
    // Scoped: the parent billing sheet must stay open.
    await expect(sheet).toBeVisible();

    // A second Escape — now outside the popover scope — closes the sheet.
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });
});
