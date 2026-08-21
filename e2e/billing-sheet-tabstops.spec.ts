import { test, expect, EMPTY_STATE, openWhenHydrated } from "./fixtures";
import { activeTestId, expectFocusWithin, openPopover, closePopover } from "./focus-helpers";
import type { Page } from "@playwright/test";

/**
 * BillingSheet tab-stop guard.
 *
 * Switching "views" inside the sheet (form ⇄ due-date popover ⇄ calendar grid ⇄
 * bill list / edit mode) must never park focus outside the sheet, and the
 * calendar must always expose exactly one roving tab stop.
 */
test.use({ seed: EMPTY_STATE });

const DAY = 'button[data-day="selected"]';
const TAB_STOP = 'button[data-testid^="billing-day-"][tabindex="0"]';

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
  return sheet;
}

/** Focus must be on a focusable element inside the sheet — never <body>. */
async function expectFocusInsideSheet(page: Page, sheet: ReturnType<Page["locator"]>) {
  await expectFocusWithin(sheet);
  const tag = await page.evaluate(() => document.activeElement?.tagName ?? "");
  expect(tag, "focus fell back to <body>").not.toBe("BODY");
  return tag;
}

async function addBill(page: Page, name: string, amount: string) {
  await page.getByTestId("billing-name").fill(name);
  await page.getByTestId("billing-amount").fill(amount);
  await page.getByTestId("billing-submit").click();
}

test.describe("BillingSheet — focus never leaves the intended tab stops", () => {
  test("Tab cycles only through sheet controls, in both directions", async ({ page }) => {
    const sheet = await openSheet(page);
    await page.getByTestId("billing-name").focus();

    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press("Tab");
      await expectFocusInsideSheet(page, sheet);
    }
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press("Shift+Tab");
      await expectFocusInsideSheet(page, sheet);
    }
  });

  test("switching between icon group, calendar and due-date popover keeps a single tab stop", async ({
    page,
  }) => {
    const sheet = await openSheet(page);
    const calendar = page.getByTestId("billing-calendar");

    // View 1: icon radiogroup (roving tabindex of its own).
    const firstIcon = sheet.locator('[data-testid^="billing-icon-"]').first();
    await firstIcon.focus();
    await page.keyboard.press("ArrowRight");
    await expectFocusInsideSheet(page, sheet);
    expect(await activeTestId(page)).toMatch(/^billing-icon-/);

    // View 2: due-date popover — opens with focus inside, Escape restores it.
    const toggle = page.getByTestId("due-date-toggle");
    const popover = page.getByTestId("due-date-popover");
    await openPopover(page, () => toggle.click(), popover);
    await page.keyboard.press("Tab");
    await expectFocusWithin(popover);
    await closePopover(page, () => page.keyboard.press("Escape"), popover, toggle);
    await expect(sheet).toBeVisible();

    // View 3: calendar grid — one roving tab stop, focus stays on it.
    const selected = calendar.locator(DAY);
    await selected.focus();
    for (const key of ["ArrowRight", "PageDown", "ArrowLeft", "PageUp", "End", "Home"]) {
      await page.keyboard.press(key);
      await expect(calendar.locator(TAB_STOP)).toHaveCount(1);
      await expect(calendar.locator(TAB_STOP)).toBeFocused();
      await expectFocusInsideSheet(page, sheet);
    }

    // Back to view 1: the icon group still has exactly one tab stop.
    await expect(sheet.locator('[data-testid^="billing-icon-"][tabindex="0"]')).toHaveCount(1);
  });

  test("entering and leaving edit mode keeps focus inside the sheet", async ({ page }) => {
    const sheet = await openSheet(page);
    await addBill(page, "Internet Rumah", "250000");

    const item = sheet.locator('[data-testid^="billing-item-"]').first();
    await expect(item).toBeVisible();
    const editBtn = sheet.locator('[data-testid^="billing-edit-"]').first();
    await editBtn.click();
    await expectFocusInsideSheet(page, sheet);

    // Edit view adds a Batal button — tabbing through it must stay in the sheet.
    const cancel = page.getByTestId("billing-cancel-edit");
    await expect(cancel).toBeVisible();
    await cancel.focus();
    await page.keyboard.press("Tab");
    await expectFocusInsideSheet(page, sheet);

    await cancel.click();
    await expectFocusInsideSheet(page, sheet);
    await expect(page.getByTestId("billing-cancel-edit")).toHaveCount(0);

    // The calendar tab stop survives the view switch.
    const calendar = page.getByTestId("billing-calendar");
    await calendar.locator(DAY).focus();
    await page.keyboard.press("ArrowDown");
    await expect(calendar.locator(TAB_STOP)).toHaveCount(1);
    await expect(calendar.locator(TAB_STOP)).toBeFocused();
  });
});
