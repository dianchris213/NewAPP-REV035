/**
 * Integration + end-to-end coverage for persisted fund-source filters.
 *
 * Guarantees:
 *  - a stale persisted type filter never hides fund sources (no empty state);
 *  - the reset button clears the persisted filter keys from localStorage;
 *  - both fund sources stay visible while an API error is being surfaced;
 *  - the reset is announced through an aria-live region and focus stays sane.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "@/lib/app-store";
import { FundSourceSheet } from "@/routes/settings";
import { Toaster } from "@/components/ui/sonner";
import { WalletApiError, persistWallet } from "@/lib/wallet-api";

vi.mock("@/lib/wallet-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wallet-api")>();
  return { ...actual, persistWallet: vi.fn(async () => {}) };
});

const persistMock = vi.mocked(persistWallet);

const STORAGE_KEY = "tmab-state-v1";
const FS_QUERY_KEY = "tmab-fund-source-query";
const FS_TYPE_KEY = "tmab-fund-source-type";

const WALLETS = [
  { id: "w1", name: "BCA Utama", type: "bank", balance: 0 },
  { id: "w2", name: "BCA Bisnis", type: "bank", balance: 0 },
];

function seedState() {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ user: null, transactions: [], wallets: WALLETS, language: "id" }),
  );
}

async function setup() {
  const user = userEvent.setup();
  render(
    <AppProvider>
      <FundSourceSheet onClose={() => {}} />
      <Toaster />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("fund-source-name")).toBeEnabled());
  return user;
}

const rows = () =>
  within(screen.getByRole("list", { name: /sumber dana/i }))
    .queryAllByRole("listitem")
    .filter((li) => li.getAttribute("data-testid") !== "fund-source-empty");

describe("Persisted fund-source filters", () => {
  beforeEach(() => {
    window.localStorage.clear();
    persistMock.mockReset();
    persistMock.mockResolvedValue(undefined);
    seedState();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("shows every wallet when the persisted type filter matches nothing", async () => {
    window.localStorage.setItem(FS_TYPE_KEY, JSON.stringify("cash"));
    await setup();

    await waitFor(() => expect(screen.getByTestId("fund-source-filter-type")).toHaveValue("all"));
    expect(screen.queryByTestId("fund-source-empty")).not.toBeInTheDocument();
    expect(await screen.findByText("BCA Utama")).toBeInTheDocument();
    expect(screen.getByText("BCA Bisnis")).toBeInTheDocument();
    expect(rows().length).toBeGreaterThanOrEqual(2);
  });

  it("announces the automatic reset through an aria-live summary", async () => {
    window.localStorage.setItem(FS_TYPE_KEY, JSON.stringify("cash"));
    window.localStorage.setItem(FS_QUERY_KEY, JSON.stringify("zzz"));
    await setup();

    const notice = await screen.findByTestId("fund-source-filter-reset-notice");
    expect(notice).toHaveAttribute("aria-live", "polite");
    expect(notice).toHaveTextContent(/semua sumber dana/i);
    expect(screen.queryByTestId("fund-source-empty")).not.toBeInTheDocument();
  });

  it("reset button clears persisted filter keys and restores all rows", async () => {
    const user = await setup();

    await user.type(screen.getByTestId("fund-source-search"), "Utama");
    await waitFor(() => expect(screen.queryByText("BCA Bisnis")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(window.localStorage.getItem(FS_QUERY_KEY)).toBe(JSON.stringify("Utama")),
    );

    const resetBtn = screen.getByTestId("fund-source-reset-filter");
    resetBtn.focus();
    expect(resetBtn).toHaveFocus();
    await user.click(resetBtn);

    await waitFor(() => expect(window.localStorage.getItem(FS_QUERY_KEY)).toBeNull());
    expect(window.localStorage.getItem(FS_TYPE_KEY)).toBeNull();
    expect(await screen.findByText("BCA Utama")).toBeInTheDocument();
    expect(screen.getByText("BCA Bisnis")).toBeInTheDocument();
    expect(screen.queryByTestId("fund-source-empty")).not.toBeInTheDocument();
    expect(await screen.findByTestId("fund-source-filter-reset-notice")).toBeInTheDocument();
  });

  it("keeps both fund sources visible when the save API fails", async () => {
    window.localStorage.setItem(FS_TYPE_KEY, JSON.stringify("cash"));
    const user = await setup();
    await waitFor(() => expect(screen.getByTestId("fund-source-filter-type")).toHaveValue("all"));

    persistMock.mockRejectedValueOnce(new WalletApiError("offline", 503));
    await user.type(screen.getByTestId("fund-source-name"), "Dompet Tunai");
    await user.click(screen.getByTestId("fund-source-submit"));
    await waitFor(() => expect(screen.getByTestId("fund-source-submit")).toBeEnabled());

    expect(screen.getByText("BCA Utama")).toBeInTheDocument();
    expect(screen.getByText("BCA Bisnis")).toBeInTheDocument();
    expect(screen.queryByTestId("fund-source-empty")).not.toBeInTheDocument();
    // Focus returns to the name field so the user can retry immediately.
    await waitFor(() => expect(screen.getByTestId("fund-source-name")).toHaveFocus());
  });
});
