import {
  test,
  expect,
  MANY_CATEGORIES_STATE,
  activate,
  waitForClickTarget,
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

const activeTestId = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset["testid"] ?? "");

/** Filter controls in DOM order — Tab must visit them in exactly this order. */
const FILTER_ORDER = ["category-search", "category-filter-type", "category-sort"] as const;

test.describe("Kategori Transaksi — filter ARIA and focus order", () => {
  test("exposes an accessible name and role for every filter control", async ({ page }) => {
    await openSheet(page);

    await expect(page.getByTestId("category-search")).toHaveAttribute("aria-label", /cari/i);
    await expect(page.getByTestId("category-search")).toHaveAttribute("type", "search");
    await expect(page.getByTestId("category-filter-type")).toHaveAttribute("aria-label", /jenis/i);
    await expect(page.getByTestId("category-sort")).toHaveAttribute("aria-label", /urut/i);

    const toggle = page.getByTestId("category-toggle-all");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute("aria-controls", "category-list");
    await expect(page.locator("#category-list")).toHaveAttribute("aria-label", /kategori/i);
    await expect(page.getByRole("combobox", { name: /jenis/i })).toBeVisible();
  });

  test("Tab walks the filter controls forward and Shift+Tab back again", async ({ page }) => {
    await openSheet(page);

    await page.getByTestId("category-search").focus();
    for (const id of FILTER_ORDER.slice(1)) {
      await page.keyboard.press("Tab");
      expect(await activeTestId(page)).toBe(id);
    }

    for (const id of [...FILTER_ORDER].reverse().slice(1)) {
      await page.keyboard.press("Shift+Tab");
      expect(await activeTestId(page)).toBe(id);
    }
    expect(await activeTestId(page)).toBe("category-search");
  });

  test("the collapse toggle stays click-targetable above the bottom nav", async ({ page }) => {
    await openSheet(page);
    const toggle = page.getByTestId("category-toggle-all");

    await waitForClickTarget(toggle);
    await activate(toggle);
    await expect(page.locator('[data-testid^="category-item-"]')).toHaveCount(3);
    await expect(toggle).toHaveAttribute("data-state", "collapsed");
  });
});
