import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "@/lib/app-store";
import { CategorySheet } from "@/routes/settings";

const STORAGE_KEY = "tmab-state-v1";
const EXPANDED_KEY = "tmab-category-expanded";

/** 5 rows: more than the 3-row collapsed preview, so the toggle is rendered. */
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
  await waitFor(() => expect(rowCount()).toBeGreaterThan(0));
  return { user, view };
}

describe("Kategori Transaksi — list completeness", () => {
  beforeEach(() => {
    window.localStorage.clear();
    seed();
  });

  it("lists every category by default: 'Semua Jenis (5)' shows 5 rows", async () => {
    await setup();
    await waitFor(() => expect(rowCount()).toBe(5));
    expect(screen.getByTestId("category-filter-type")).toHaveTextContent("(5)");
    // No hidden rows, so no truncation notice.
    expect(screen.queryByTestId("category-collapsed-notice")).toBeNull();
    expect(screen.getByTestId("category-toggle-all")).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses to a 3-row preview and announces how many rows are hidden", async () => {
    const { user } = await setup();
    await waitFor(() => expect(rowCount()).toBe(5));

    await user.click(screen.getByTestId("category-toggle-all"));
    await waitFor(() => expect(rowCount()).toBe(3));
    const toggle = screen.getByTestId("category-toggle-all");
    expect(toggle).toHaveTextContent("Tampilkan semua (5)");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("category-collapsed-notice")).toHaveTextContent("3/5");
  });

  it("reveals every row again when the user picks “Tampilkan semua (N)”", async () => {
    const { user } = await setup();
    const toggle = () => screen.getByTestId("category-toggle-all");
    await user.click(toggle());
    await waitFor(() => expect(rowCount()).toBe(3));

    await user.click(toggle());
    await waitFor(() => expect(rowCount()).toBe(5));
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(toggle()).toHaveTextContent("Sembunyikan");
    expect(screen.queryByTestId("category-collapsed-notice")).toBeNull();
  });

  it("returns to the collapsed preview when the Jenis filter is switched off", async () => {
    const { user } = await setup();
    await user.click(screen.getByTestId("category-toggle-all"));
    await waitFor(() => expect(rowCount()).toBe(3));

    const select = screen.getByTestId("category-filter-type");
    // Filtering bypasses the collapse: every matching row is shown.
    await user.selectOptions(select, "expense");
    await waitFor(() => expect(screen.queryByTestId("category-toggle-all")).toBeNull());
    expect(rowCount()).toBe(3);

    await user.selectOptions(select, "income");
    await waitFor(() => expect(rowCount()).toBe(2));

    await user.selectOptions(select, "all");
    await waitFor(() => expect(screen.getByTestId("category-toggle-all")).toBeTruthy());
    expect(rowCount()).toBe(3);
    expect(screen.getByTestId("category-toggle-all")).toHaveAttribute("aria-expanded", "false");
  });

  it("persists the collapsed choice across remounts (page navigation)", async () => {
    const first = await setup();
    await first.user.click(screen.getByTestId("category-toggle-all"));
    await waitFor(() => expect(rowCount()).toBe(3));
    await waitFor(() => expect(window.localStorage.getItem(EXPANDED_KEY)).toBe("false"));

    // Leave the page and come back.
    first.view.unmount();
    await setup();
    await waitFor(() => expect(screen.getByTestId("category-toggle-all")).toBeTruthy());
    expect(rowCount()).toBe(3);
    expect(screen.getByTestId("category-toggle-all")).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("category-collapsed-notice")).toHaveTextContent("3/5");
  });

  it("persists the expanded choice across remounts (page navigation)", async () => {
    const first = await setup();
    await first.user.click(screen.getByTestId("category-toggle-all"));
    await waitFor(() => expect(rowCount()).toBe(3));
    await first.user.click(screen.getByTestId("category-toggle-all"));
    await waitFor(() => expect(rowCount()).toBe(5));

    first.view.unmount();
    await setup();
    await waitFor(() => expect(rowCount()).toBe(5));
    expect(screen.getByTestId("category-toggle-all")).toHaveAttribute("aria-expanded", "true");
  });
});
