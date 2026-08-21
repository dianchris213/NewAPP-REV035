/**
 * A11y contract for the "Kategori Transaksi" filter bar.
 *
 * Two guarantees are locked down here:
 * 1. every filter control exposes a stable role + accessible name (screen
 *    readers must be able to announce Cari / Jenis / Urutkan without relying
 *    on visual proximity), and
 * 2. the Tab / Shift+Tab order matches the visual order, with no focus trap
 *    and no control skipped.
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

function seed() {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      user: { id: "u1", name: "Tester", provider: "telegram" },
      transactions: [],
      wallets: [],
      walletActivity: [],
      categories: CATEGORIES,
      language: "id",
    }),
  );
}

function rowCount() {
  return document.querySelectorAll('[data-testid^="category-item-"]').length;
}

async function setup() {
  const user = userEvent.setup();
  const view = render(
    <AppProvider>
      <CategorySheet onClose={() => {}} />
    </AppProvider>,
  );
  await waitFor(() => expect(rowCount()).toBe(CATEGORIES.length));
  return { user, view };
}

/** Filter controls in DOM order — Tab must visit them in exactly this order. */
const FILTER_ORDER = ["category-search", "category-filter-type", "category-sort"] as const;

const activeTestId = () =>
  (document.activeElement as HTMLElement | null)?.dataset["testid"] ?? null;

describe("Kategori Transaksi — filter ARIA labels and roles", () => {
  beforeEach(() => {
    window.localStorage.clear();
    seed();
  });

  it("exposes a role and accessible name for every filter control", async () => {
    await setup();

    const search = screen.getByTestId("category-search");
    expect(search).toHaveAttribute("type", "search");
    expect(search.getAttribute("aria-label")).toMatch(/cari/i);
    expect(screen.getByRole("searchbox", { name: /cari/i })).toBe(search);

    const type = screen.getByTestId("category-filter-type");
    expect(type.tagName).toBe("SELECT");
    expect(type.getAttribute("aria-label")).toMatch(/jenis/i);
    expect(screen.getByRole("combobox", { name: /jenis/i })).toBe(type);

    const sort = screen.getByTestId("category-sort");
    expect(sort.getAttribute("aria-label")).toMatch(/urut/i);
    expect(screen.getByRole("combobox", { name: /urut/i })).toBe(sort);
  });

  it("advertises the per-Jenis counts on each option", async () => {
    await setup();
    const options = screen
      .getByTestId("category-filter-type")
      .querySelectorAll<HTMLOptionElement>("option");
    expect(Array.from(options).map((o) => o.textContent)).toEqual([
      "Semua Jenis (5)",
      "Pemasukan (2)",
      "Pengeluaran (3)",
    ]);
  });

  it("wires the collapse toggle to the list it controls", async () => {
    const { user } = await setup();
    const toggle = screen.getByTestId("category-toggle-all");
    expect(toggle).toHaveAttribute("aria-controls", "category-list");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("category-list")?.getAttribute("aria-label")).toMatch(
      /kategori/i,
    );

    await user.click(toggle);
    await waitFor(() =>
      expect(screen.getByTestId("category-toggle-all")).toHaveAttribute("aria-expanded", "false"),
    );
    // The hidden-row count is announced politely, not silently dropped.
    const notice = screen.getByTestId("category-collapsed-notice");
    expect(notice).toHaveAttribute("role", "status");
    expect(notice).toHaveAttribute("aria-live", "polite");
  });
});

describe("Kategori Transaksi — filter focus order", () => {
  beforeEach(() => {
    window.localStorage.clear();
    seed();
  });

  it("Tab walks Cari → Jenis → Urutkan in visual order", async () => {
    const { user } = await setup();
    screen.getByTestId("category-search").focus();
    expect(activeTestId()).toBe(FILTER_ORDER[0]);

    for (const id of FILTER_ORDER.slice(1)) {
      await user.tab();
      expect(activeTestId()).toBe(id);
    }
  });

  it("Shift+Tab walks back through the same controls", async () => {
    const { user } = await setup();
    screen.getByTestId("category-sort").focus();

    for (const id of [...FILTER_ORDER].reverse().slice(1)) {
      await user.tab({ shift: true });
      expect(activeTestId()).toBe(id);
    }
    expect(activeTestId()).toBe(FILTER_ORDER[0]);
  });

  it("keeps the reset button in the forward order once a filter is active", async () => {
    const { user } = await setup();
    await user.selectOptions(screen.getByTestId("category-filter-type"), "income");
    await waitFor(() => expect(screen.getByTestId("category-reset-filter")).toBeTruthy());

    screen.getByTestId("category-sort").focus();
    await user.tab();
    expect(activeTestId()).toBe("category-reset-filter");
    await user.tab({ shift: true });
    expect(activeTestId()).toBe("category-sort");
  });

  it("reaches the collapse toggle by keyboard and toggles it with Enter", async () => {
    const { user } = await setup();
    const toggle = screen.getByTestId("category-toggle-all");
    toggle.focus();
    expect(toggle).toHaveFocus();

    await user.keyboard("{Enter}");
    await waitFor(() => expect(rowCount()).toBe(3));
    expect(screen.getByTestId("category-toggle-all")).toHaveFocus();
    expect(screen.getByTestId("category-toggle-all")).toHaveTextContent("Tampilkan semua (5)");
  });
});
