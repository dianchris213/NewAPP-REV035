/**
 * Visual regression guard (DOM layout contract) for the Kategori Transaksi
 * list. jsdom cannot rasterise pixels, so the structural style contract is
 * snapshotted instead: row order/count, container classes and — importantly —
 * the highlight applied to the active selection (the Jenis option in effect
 * and the collapsed "Tampilkan semua (N)" affordance).
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

function rows() {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="category-item-"]'));
}

/** Structural fingerprint of the list plus the active-selection highlight. */
function listLayout() {
  const list = document.getElementById("category-list") as HTMLElement;
  const toggle = screen.queryByTestId("category-toggle-all");
  const select = screen.getByTestId("category-filter-type") as HTMLSelectElement;
  const notice = screen.queryByTestId("category-collapsed-notice");
  return {
    list: { ariaLabel: list.getAttribute("aria-label"), className: list.className },
    rows: rows().map((row) => ({
      testId: row.dataset["testid"] ?? null,
      name: row.querySelector("span")?.textContent ?? null,
      className: row.className,
    })),
    activeType: {
      value: select.value,
      selectedLabel: select.selectedOptions[0]?.textContent ?? null,
      options: Array.from(select.options).map((o) => ({
        value: o.value,
        label: o.textContent,
        selected: o.selected,
      })),
    },
    toggle: toggle
      ? {
          text: toggle.textContent,
          state: toggle.getAttribute("data-state"),
          expanded: toggle.getAttribute("aria-expanded"),
          // The collapsed affordance is highlighted with the primary palette.
          className: toggle.className,
        }
      : null,
    collapsedNotice: notice ? notice.textContent : null,
  };
}

async function setup() {
  const user = userEvent.setup();
  render(
    <AppProvider>
      <CategorySheet onClose={() => {}} />
    </AppProvider>,
  );
  await waitFor(() => expect(rows()).toHaveLength(CATEGORIES.length));
  return { user };
}

describe("Visual regression — Kategori Transaksi list", () => {
  beforeEach(() => {
    window.localStorage.clear();
    seed();
  });

  it("keeps the fully populated (expanded) list layout stable", async () => {
    await setup();
    expect(listLayout()).toMatchSnapshot("category-list-expanded-layout");
  });

  it("keeps the collapsed preview layout and its highlighted toggle stable", async () => {
    const { user } = await setup();
    await user.click(screen.getByTestId("category-toggle-all"));
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(listLayout()).toMatchSnapshot("category-list-collapsed-layout");
  });

  it("keeps the active Jenis selection highlight stable", async () => {
    const { user } = await setup();
    await user.selectOptions(screen.getByTestId("category-filter-type"), "income");
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(listLayout()).toMatchSnapshot("category-list-income-layout");
  });
});
