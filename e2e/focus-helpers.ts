import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Shared, animation-frame-free waiting strategy for focus-sensitive UI.
 *
 * Every helper asserts on committed DOM state (visibility + `document.activeElement`)
 * instead of sleeping or trusting `requestAnimationFrame`, so keyboard flows stay
 * deterministic across machines and CI retries.
 */

/** `data-testid` of the currently focused element ("" when focus is on <body>). */
export async function activeTestId(page: Page): Promise<string> {
  return page.evaluate(
    () => (document.activeElement as HTMLElement | null)?.dataset["testid"] ?? "",
  );
}

/** Poll until `document.activeElement` carries the expected test id. */
export async function expectActiveTestId(page: Page, testId: string): Promise<void> {
  await expect.poll(() => activeTestId(page), { timeout: 5_000 }).toBe(testId);
}

/** Poll until focus is inside the given container. */
export async function expectFocusWithin(container: Locator): Promise<void> {
  await expect
    .poll(() => container.evaluate((el) => el.contains(document.activeElement)), {
      timeout: 5_000,
    })
    .toBe(true);
}

/** Run `open`, then wait for the popover to be visible AND to own focus. */
export async function openPopover(
  page: Page,
  open: () => Promise<void>,
  popover: Locator,
): Promise<void> {
  await open();
  await expect(popover).toBeVisible();
  await expectFocusWithin(popover);
  void page;
}

/**
 * Run `close`, then wait for the popover to leave the DOM and for focus to be
 * restored to `restoreTo` — both asserted, never assumed.
 */
export async function closePopover(
  page: Page,
  close: () => Promise<void>,
  popover: Locator,
  restoreTo: Locator,
): Promise<void> {
  await close();
  await expect(popover).toBeHidden();
  await expect(restoreTo).toBeFocused();
  const testId = await restoreTo.getAttribute("data-testid");
  if (testId) await expectActiveTestId(page, testId);
}

/**
 * Press a key inside a roving-tabindex grid and assert the resulting focus:
 * the newly selected day must be focused and remain the single tab stop.
 */
export async function pressAndExpectGridFocus(
  page: Page,
  key: string,
  grid: Locator,
  selectedSelector: string,
  tabStopSelector: string,
): Promise<string> {
  await page.keyboard.press(key);
  await expect(grid.locator(selectedSelector)).toBeFocused();
  await expect(grid.locator(tabStopSelector)).toHaveCount(1);
  await expectFocusWithin(grid);
  return activeTestId(page);
}
