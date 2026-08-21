/**
 * Edge cases for the "Kategori Transaksi" filter bar:
 * 1. no Jenis selected (the default "Semua Jenis" state) must not render any
 *    reset affordance and must not highlight a selection,
 * 2. an empty category list must show the empty state without a reset button
 *    while the filter controls stay reachable, and
 * 3. rapid, back-to-back filter changes must never move or lose keyboard
 *    focus — Tab order stays identical before and after the burst.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "@/lib/app-store";
import { CategorySheet } from "@/routes/settings";

const STORAGE_KEY = "tmab-state-v1";

const CATEGORIES = [
  { id: "c1", name: "Bonus", type: "income" as const },
  { id: "c2", name: "Gaji", type: "income" as const },
  { id: "c3", name: "Internet", type: "expense" as const },
  { id: "c4", name: "Kopi", type: "expense" as const },
  { id: "c5", name: "Makan", type: "expense" as const },
];

function seed(categories: typeof CATEGORIES) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      user: { id: "u1", name: "Tester", provider: "telegram" },
      transactions: [],
      wallets: [],
      walletActivity: [],
      categories,
      language: "id",
    }),
  );
}

const rowCount = () => document.querySelectorAll('[data-testid^="category-item-"]').length;

const activeTestId = () =>
  (document.activeElement as HTMLElement | null)?.dataset["testid"] ?? null;

async function setup(categories: typeof CATEGORIES) {
  seed(categories);
  const user = userEvent.setup();
  render(
    <AppProvider>
      <CategorySheet onClose={() => {}} />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("category-search")).toBeTruthy());
  return user;
}

/** Walk Tab from the search field and collect the visited testids. */
async function tabSequence(user: ReturnType<typeof userEvent.setup>, steps: number) {
  screen.getByTestId("category-search").focus();
  const visited = [activeTestId()];
  for (let i = 0; i < steps; i += 1) {
    await user.tab();
    visited.push(activeTestId());
  }
  return visited;
}

describe("Kategori Transaksi — filter edge cases", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders no reset affordance and no active highlight when no Jenis is selected", async () => {
    await setup(CATEGORIES);
    await waitFor(() => expect(rowCount()).toBeGreaterThan(0));

    const type = screen.getByTestId("category-filter-type") as HTMLSelectElement;
    expect(type.value).toBe("all");
    expect(screen.queryByTestId("category-reset-filter")).toBeNull();
    expect(screen.queryByTestId("category-filter-summary")).toBeNull();
    // "Tampilkan semua (N)" is the only collapse affordance and its state stays
    // self-consistent while nothing is filtered.
    const toggle = screen.getByTestId("category-toggle-all");
    const collapsed = toggle.getAttribute("data-state") === "collapsed";
    expect(toggle.getAttribute("aria-expanded")).toBe(String(!collapsed));
    expect(toggle.getAttribute("aria-controls")).toBe("category-list");
  });

  it("shows the empty state without a reset button and keeps filters usable", async () => {
    await setup([]);

    expect(await screen.findByTestId("category-empty")).toBeTruthy();
    expect(rowCount()).toBe(0);
    expect(screen.queryByTestId("category-empty-reset")).toBeNull();
    expect(screen.queryByTestId("category-toggle-all")).toBeNull();
    expect(screen.queryByTestId("category-filter-summary")).toBeNull();

    // The controls still exist and are focusable so a screen-reader user is
    // never stranded in an empty list.
    const search = screen.getByTestId("category-search");
    search.focus();
    expect(activeTestId()).toBe("category-search");
  });

  it("keeps the empty state (no rows, no reset) when a filter matches nothing", async () => {
    const user = await setup(CATEGORIES);
    await waitFor(() => expect(rowCount()).toBeGreaterThan(0));

    await user.type(screen.getByTestId("category-search"), "zzz");
    await waitFor(() => expect(rowCount()).toBe(0));

    expect(screen.getByTestId("category-empty")).toBeTruthy();
    // With an active filter the empty state offers exactly one reset control.
    expect(screen.getAllByTestId("category-empty-reset")).toHaveLength(1);
  });

  it("keeps the Tab order stable across rapid successive filter changes", async () => {
    const user = await setup(CATEGORIES);
    await waitFor(() => expect(rowCount()).toBeGreaterThan(0));

    const before = await tabSequence(user, 2);
    expect(before).toEqual(["category-search", "category-filter-type", "category-sort"]);

    const type = screen.getByTestId("category-filter-type");
    // Burst of changes with no awaited settle between them.
    await user.selectOptions(type, "income");
    await user.selectOptions(type, "expense");
    await user.selectOptions(type, "all");
    await user.selectOptions(type, "income");
    await waitFor(() => expect(rowCount()).toBe(2));

    // Focus stays on the control that produced the change.
    expect(activeTestId()).toBe("category-filter-type");

    // And Tab continues in the same order, now including the reset button that
    // appeared because a filter is active.
    const after = await tabSequence(user, 3);
    expect(after).toEqual([
      "category-search",
      "category-filter-type",
      "category-sort",
      "category-reset-filter",
    ]);
  });

  it("settles on the last value after a rapid search + Jenis burst without losing focus", async () => {
    const user = await setup(CATEGORIES);
    await waitFor(() => expect(rowCount()).toBeGreaterThan(0));

    const search = screen.getByTestId("category-search") as HTMLInputElement;
    const type = screen.getByTestId("category-filter-type") as HTMLSelectElement;

    await user.type(search, "ga");
    await user.selectOptions(type, "expense");
    await user.clear(search);
    await user.selectOptions(type, "income");
    await user.type(search, "gaji");

    await waitFor(() => expect(rowCount()).toBe(1));
    expect(type.value).toBe("income");
    expect(search.value).toBe("gaji");
    expect(activeTestId()).toBe("category-search");
    expect(screen.getAllByTestId("category-reset-filter")).toHaveLength(1);
  });
});
