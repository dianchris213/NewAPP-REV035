import { test, expect, EMPTY_STATE, openWhenHydrated } from "./fixtures";
import { activeTestId, expectFocusWithin } from "./focus-helpers";
import type { Page } from "@playwright/test";

/**
 * Guard: ArrowLeft/ArrowRight and PageUp/PageDown must never park focus outside
 * the calendar's roving tab stop — not on <body>, not on the month buttons, not
 * on a day that lost `tabindex="0"` — including while the month changes.
 */
test.use({ seed: EMPTY_STATE });

const DAY = 'button[data-day="selected"]';
const TAB_STOP = 'button[data-testid^="billing-day-"][tabindex="0"]';

async function openCalendar(page: Page) {
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

/** Assert the invariant after a key press: focus === the single tab stop === the selected day. */
async function expectSingleTabStopFocused(page: Page, calendar: ReturnType<Page["locator"]>) {
  await expect(calendar.locator(TAB_STOP)).toHaveCount(1);
  await expect(calendar.locator(TAB_STOP)).toBeFocused();
  await expect(calendar.locator(DAY)).toBeFocused();
  await expectFocusWithin(calendar);
  const id = await activeTestId(page);
  expect(id, "focus escaped the calendar day grid").toMatch(/^billing-day-/);
  return id;
}

test.describe("BillingCalendar — focus never leaves the intended tab stop", () => {
  test("ArrowLeft/ArrowRight keep the single tab stop focused across month transitions", async ({
    page,
  }) => {
    const calendar = await openCalendar(page);
    const label = page.getByTestId("billing-calendar-label");
    const months = new Set<string>();
    const startDay = await activeTestId(page);
    const startLabel = await label.textContent();

    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press("ArrowRight");
      await expectSingleTabStopFocused(page, calendar);
      months.add((await label.textContent()) ?? "");
    }
    expect(months.size, "40 ArrowRight presses should cross at least one month").toBeGreaterThan(1);

    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press("ArrowLeft");
      await expectSingleTabStopFocused(page, calendar);
    }
    // Walking back the same distance returns to the original day and month.
    expect(await activeTestId(page)).toBe(startDay);
    await expect(label).toHaveText(startLabel ?? "");
  });

  test("PageDown/PageUp keep the single tab stop focused for a full year of transitions", async ({
    page,
  }) => {
    const calendar = await openCalendar(page);
    const label = page.getByTestId("billing-calendar-label");
    const start = await label.textContent();
    const labels: string[] = [];

    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("PageDown");
      await expectSingleTabStopFocused(page, calendar);
      labels.push((await label.textContent()) ?? "");
    }
    expect(new Set(labels).size, "each PageDown must land on a distinct month").toBe(12);

    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("PageUp");
      await expectSingleTabStopFocused(page, calendar);
    }
    await expect(label).toHaveText(start ?? "");
  });

  test("mixing arrows and page keys never focuses <body> or a non-day control", async ({
    page,
  }) => {
    const calendar = await openCalendar(page);
    const keys = [
      "ArrowRight",
      "PageDown",
      "ArrowLeft",
      "ArrowLeft",
      "PageUp",
      "ArrowRight",
      "PageDown",
      "PageDown",
      "ArrowLeft",
      "PageUp",
      "PageUp",
      "ArrowRight",
    ];
    for (const key of keys) {
      await page.keyboard.press(key);
      await expectSingleTabStopFocused(page, calendar);
    }
  });
});
