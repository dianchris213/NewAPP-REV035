import { test, expect, EMPTY_STATE, openWhenHydrated } from "./fixtures";
import { activeTestId, expectFocusWithin, pressAndExpectGridFocus } from "./focus-helpers";

/**
 * Arrow-key focus movement across BillingCalendar month transitions.
 *
 * Every step asserts the committed DOM/focus state through the shared helpers,
 * so no assertion depends on animation-frame timing.
 */
test.use({ seed: EMPTY_STATE });

const DAY = 'button[data-day="selected"]';
const TAB_STOP = 'button[data-testid^="billing-day-"][tabindex="0"]';

async function openCalendar(page: import("@playwright/test").Page) {
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
  const calendar = page.getByTestId("billing-calendar");
  await expect(calendar).toBeVisible();
  const selected = calendar.locator(DAY);
  await selected.focus();
  await expect(selected).toBeFocused();
  return calendar;
}

test.describe("BillingCalendar — focus across month transitions", () => {
  test("PageDown/PageUp change the month and keep focus on the selected day", async ({ page }) => {
    const calendar = await openCalendar(page);
    const label = page.getByTestId("billing-calendar-label");
    const start = await label.textContent();

    await pressAndExpectGridFocus(page, "PageDown", calendar, DAY, TAB_STOP);
    await expect(label).not.toHaveText(start ?? "");
    const nextMonth = await label.textContent();

    await pressAndExpectGridFocus(page, "PageDown", calendar, DAY, TAB_STOP);
    await expect(label).not.toHaveText(nextMonth ?? "");

    await pressAndExpectGridFocus(page, "PageUp", calendar, DAY, TAB_STOP);
    await expect(label).toHaveText(nextMonth ?? "");

    await pressAndExpectGridFocus(page, "PageUp", calendar, DAY, TAB_STOP);
    await expect(label).toHaveText(start ?? "");
    await expectFocusWithin(calendar);
  });

  test("Home/End then arrows roll over the month boundary with focus restored", async ({
    page,
  }) => {
    const calendar = await openCalendar(page);
    const label = page.getByTestId("billing-calendar-label");
    const start = await label.textContent();

    await pressAndExpectGridFocus(page, "End", calendar, DAY, TAB_STOP);
    const lastDay = await activeTestId(page);
    await expect(label).toHaveText(start ?? "");

    // Crossing forward from the last day must advance the month and move focus
    // with it (never falling back to <body>).
    const firstOfNext = await pressAndExpectGridFocus(page, "ArrowRight", calendar, DAY, TAB_STOP);
    expect(firstOfNext).not.toBe(lastDay);
    await expect(label).not.toHaveText(start ?? "");

    // …and crossing back restores both the month label and the focused day.
    const back = await pressAndExpectGridFocus(page, "ArrowLeft", calendar, DAY, TAB_STOP);
    expect(back).toBe(lastDay);
    await expect(label).toHaveText(start ?? "");

    await pressAndExpectGridFocus(page, "Home", calendar, DAY, TAB_STOP);
    const firstDay = await activeTestId(page);
    // Crossing backwards from the 1st goes to the previous month.
    const prevMonthDay = await pressAndExpectGridFocus(page, "ArrowLeft", calendar, DAY, TAB_STOP);
    expect(prevMonthDay).not.toBe(firstDay);
    await expect(label).not.toHaveText(start ?? "");

    await pressAndExpectGridFocus(page, "ArrowRight", calendar, DAY, TAB_STOP);
    await expect(label).toHaveText(start ?? "");
    expect(await activeTestId(page)).toBe(firstDay);
  });

  test("ArrowDown/ArrowUp weeks stay focused when they spill into the next month", async ({
    page,
  }) => {
    const calendar = await openCalendar(page);
    const label = page.getByTestId("billing-calendar-label");
    const start = await label.textContent();

    await pressAndExpectGridFocus(page, "End", calendar, DAY, TAB_STOP);
    const before = await activeTestId(page);
    await pressAndExpectGridFocus(page, "ArrowDown", calendar, DAY, TAB_STOP);
    await expect(label).not.toHaveText(start ?? "");

    await pressAndExpectGridFocus(page, "ArrowUp", calendar, DAY, TAB_STOP);
    await expect(label).toHaveText(start ?? "");
    expect(await activeTestId(page)).toBe(before);
  });
});
