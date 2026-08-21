import { test, expect, EMPTY_STATE, openWhenHydrated } from "./fixtures";
import { analyzeA11y } from "./a11y";

/** axe audit + keyboard navigation for BillingCalendar and the due-date picker. */
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

test.describe("BillingCalendar — accessibility", () => {
  test("raises no axe violations with an empty bill list", async ({ page }) => {
    await openSheet(page);
    const calendar = page.getByTestId("billing-calendar");
    await expect(calendar).toBeVisible();
    await expect(page.getByTestId("billing-calendar-detail")).toContainText(
      /tidak ada tagihan jatuh tempo/i,
    );

    const violations = await analyzeA11y(page, '[data-testid="billing-calendar"]');
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test("exposes grid roles and a labelled month navigation", async ({ page }) => {
    await openSheet(page);
    const grid = page.getByTestId("billing-calendar").getByRole("grid");
    await expect(grid).toHaveAttribute("aria-label", /kalender jatuh tempo/i);
    await expect(page.getByTestId("billing-calendar-prev")).toHaveAttribute(
      "aria-label",
      "Bulan sebelumnya",
    );
    await expect(page.getByTestId("billing-calendar-next")).toHaveAttribute(
      "aria-label",
      "Bulan berikutnya",
    );

    const label = await page.getByTestId("billing-calendar-label").textContent();
    await page.getByTestId("billing-calendar-next").click();
    await expect(page.getByTestId("billing-calendar-label")).not.toHaveText(label ?? "");
  });

  test("arrow keys move the focused day and keep a single tab stop", async ({ page }) => {
    await openSheet(page);
    const grid = page.getByTestId("billing-calendar");
    const tabbable = await grid.locator('button[data-testid^="billing-day-"][tabindex="0"]').count();
    expect(tabbable).toBe(1);

    await grid.locator('button[data-day="selected"]').focus();
    const before = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset["testid"] ?? "",
    );
    await page.keyboard.press("ArrowRight");
    const afterRight = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset["testid"] ?? "",
    );
    expect(afterRight).not.toBe(before);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowLeft");
    const back = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset["testid"] ?? "",
    );
    expect(back).toBe(before);
  });
});

test.describe("Due-date picker — accessibility", () => {
  test("manual input stays editable and the popover passes axe", async ({ page }) => {
    await openSheet(page);
    const input = page.getByTestId("billing-due-date");
    await input.fill("2026-08-21");
    await expect(input).toHaveValue("2026-08-21");

    await page.getByTestId("billing-due-date-toggle").click();
    const popover = page.getByTestId("billing-due-date-popover");
    await expect(popover).toBeVisible();
    await expect(page.getByTestId("billing-due-day-2026-08-21")).toBeFocused();

    const violations = await analyzeA11y(page, '[data-testid="billing-due-date-popover"]');
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);

    await page.keyboard.press("ArrowRight");
    await expect(input).toHaveValue("2026-08-22");
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(page.getByTestId("billing-due-date-toggle")).toBeFocused();
  });
});
