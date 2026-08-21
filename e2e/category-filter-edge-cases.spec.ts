import {
  test,
  expect,
  EMPTY_STATE,
  MANY_CATEGORIES_STATE,
  activate,
  openCategorySheet,
  openWhenHydrated,
} from "./fixtures";
import type { Page } from "@playwright/test";

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

const focusedTestId = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? null);

/** Tab N times and report the testid visited at each stop. */
async function tabTrail(page: Page, steps: number) {
  const trail: (string | null)[] = [await focusedTestId(page)];
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press("Tab");
    trail.push(await focusedTestId(page));
  }
  return trail;
}

test.describe("Kategori Transaksi — edge cases", () => {
  test.describe("empty list", () => {
    test.use({ seed: EMPTY_STATE });

    test("shows the empty state with no reset, no summary and no show-all control", async ({
      page,
    }) => {
      await openSheet(page);

      await expect(page.getByTestId("category-empty")).toBeVisible();
      await expect(page.locator('[data-testid^="category-item-"]')).toHaveCount(0);
      await expect(page.getByTestId("category-empty-reset")).toHaveCount(0);
      await expect(page.getByTestId("category-reset-filter")).toHaveCount(0);
      await expect(page.getByTestId("category-filter-summary")).toHaveCount(0);
      await expect(page.getByTestId("category-toggle-all")).toHaveCount(0);

      // Filters remain keyboard reachable in the empty list.
      await page.getByTestId("category-search").focus();
      expect(await tabTrail(page, 2)).toEqual([
        "category-search",
        "category-filter-type",
        "category-sort",
      ]);
    });
  });

  test.describe("populated", () => {
    test.use({ seed: MANY_CATEGORIES_STATE });

    test("no Jenis selected renders exactly one filter control set and no reset", async ({
      page,
    }) => {
      await openSheet(page);

      await expect(page.getByTestId("category-filter-type")).toHaveValue("all");
      await expect(page.getByTestId("category-reset-filter")).toHaveCount(0);
      // Regression guard: the reset action must never be duplicated on screen.
      await expect(page.getByRole("button", { name: /reset filter/i })).toHaveCount(0);
      await expect(page.getByTestId("category-search")).toHaveCount(1);
      await expect(page.getByTestId("category-sort")).toHaveCount(1);
    });

    test("rapid successive filter changes keep focus and Tab order consistent", async ({
      page,
    }) => {
      await openSheet(page);
      const type = page.getByTestId("category-filter-type");

      // Keyboard-driven burst with no settle in between: focus must survive
      // every re-render triggered by the rapid Jenis changes.
      await type.focus();
      await type.selectOption("income");
      await type.selectOption("expense");
      await type.selectOption("all");
      await type.selectOption("income");
      await type.focus();

      await expect(page.locator('[data-testid^="category-item-"]')).toHaveCount(2);
      await expect(type).toHaveValue("income");
      expect(await focusedTestId(page)).toBe("category-filter-type");

      await page.getByTestId("category-search").focus();
      expect(await tabTrail(page, 3)).toEqual([
        "category-search",
        "category-filter-type",
        "category-sort",
        "category-reset-filter",
      ]);

      // Exactly one reset control, and it clears everything in one press.
      await expect(page.getByRole("button", { name: /reset filter/i })).toHaveCount(1);
      await activate(page.getByTestId("category-reset-filter"));
      await expect(type).toHaveValue("all");
      await expect(page.getByTestId("category-reset-filter")).toHaveCount(0);
    });

    test("typing and clearing the search in quick succession never strands focus", async ({
      page,
    }) => {
      await openSheet(page);
      const search = page.getByTestId("category-search");

      await search.fill("ga");
      await search.fill("");
      await search.fill("zzzz");
      await expect(page.getByTestId("category-empty")).toBeVisible();
      await expect(page.locator('[data-testid^="category-item-"]')).toHaveCount(0);

      await search.fill("gaji");
      await expect(page.locator('[data-testid^="category-item-"]')).toHaveCount(1);
      expect(await focusedTestId(page)).toBe("category-search");
    });
  });
});
