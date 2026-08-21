import {
  test,
  expect,
  MANY_CATEGORIES_STATE,
  activate,
  openCategorySheet,
  openWhenHydrated,
} from "./fixtures";
import type { Page } from "@playwright/test";

test.use({ seed: MANY_CATEGORIES_STATE });

async function openSheet(page: Page) {
  const { row, sheet } = await openCategorySheet(page);
  await openWhenHydrated(
    () => row.click(),
    async () => {
      await expect(sheet).toBeVisible({ timeout: 1_000 });
    },
  );
  return sheet;
}

/** Test id of the currently focused element, if any. */
const activeTestId = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset["testid"] ?? "");

/** Tab forward until the wanted control has focus (bounded, so it can fail). */
async function tabTo(page: Page, testId: string) {
  for (let i = 0; i < 30; i++) {
    if ((await activeTestId(page)) === testId) return;
    await page.keyboard.press("Tab");
  }
  expect(await activeTestId(page), `never reached ${testId} with Tab`).toBe(testId);
}

test.describe("Kategori Transaksi — filter controls are keyboard operable", () => {
  test("every filter control is reachable with Tab", async ({ page }) => {
    await openSheet(page);
    for (const id of [
      "category-search",
      "category-filter-type",
      "category-sort",
      "category-toggle-all",
    ]) {
      await tabTo(page, id);
      await expect(page.getByTestId(id)).toBeFocused();
    }
  });

  test("Enter on the collapse toggle works even where the bottom nav overlaps", async ({
    page,
  }) => {
    await openSheet(page);
    const rows = page.locator('[data-testid^="category-item-"]');
    const toggle = page.getByTestId("category-toggle-all");

    await expect(rows).toHaveCount(5);
    await tabTo(page, "category-toggle-all");
    await page.keyboard.press("Enter");
    await expect(rows).toHaveCount(3);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByTestId("category-collapsed-notice")).toHaveText("3/5");

    await tabTo(page, "category-toggle-all");
    await page.keyboard.press("Enter");
    await expect(rows).toHaveCount(5);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  test("typing a query and pressing Enter on Reset filter never gets intercepted", async ({
    page,
  }) => {
    await openSheet(page);
    const rows = page.locator('[data-testid^="category-item-"]');

    await tabTo(page, "category-search");
    await page.keyboard.type("ko");
    await expect(rows).toHaveCount(1);

    // Pointer-first with a keyboard fallback: the reset control sits behind the
    // bottom navigation on short viewports.
    await activate(page.getByTestId("category-reset-filter"));
    await expect(page.getByTestId("category-search")).toHaveValue("");
    await expect(rows).toHaveCount(5);
  });

  test("Enter on the no-results reset control restores the list", async ({ page }) => {
    await openSheet(page);
    const rows = page.locator('[data-testid^="category-item-"]');

    await page.getByTestId("category-search").fill("zzzz");
    await expect(rows).toHaveCount(0);
    await activate(page.getByTestId("category-empty-reset"));
    await expect(rows).toHaveCount(5);
  });
});
