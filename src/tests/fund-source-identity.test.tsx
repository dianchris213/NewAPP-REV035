/**
 * Identity regression coverage for fund sources (Sumber Dana).
 *
 * Guarantees:
 *  - two distinct fund sources (BCA vs BRI) always render as two rows, even when
 *    they were created inside the same millisecond;
 *  - restored state is deduplicated by unique id, never by name or type;
 *  - a stale persisted type filter is sanitized to "all" on load, so both fund
 *    sources are visible and no empty state appears.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider, createWalletId, dedupeWallets } from "@/lib/app-store";
import { FundSourceSheet } from "@/routes/settings";
import { sanitizeFilters } from "@/lib/fund-source-filter";

const STORAGE_KEY = "tmab-state-v1";
const FS_TYPE_KEY = "tmab-fund-source-type";

const rows = () =>
  within(screen.getByRole("list", { name: /sumber dana/i }))
    .queryAllByRole("listitem")
    .filter((li) => li.getAttribute("data-testid")?.startsWith("fund-source-item-"));

describe("Fund source identity", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("never reuses an id, even within a single millisecond", () => {
    const spy = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const ids = new Set(Array.from({ length: 200 }, () => createWalletId()));
    spy.mockRestore();
    expect(ids.size).toBe(200);
  });

  it("deduplicates restored wallets by id only, keeping BCA and BRI apart", () => {
    const result = dedupeWallets([
      { id: "w1", name: "BCA", type: "bank", balance: 1000 },
      { id: "w1", name: "BRI", type: "bank", balance: 2000 },
      { name: "Tanpa id", type: "cash", balance: 0 },
      { id: "w9", name: "", type: "bank", balance: 0 },
      "corrupt",
    ]);
    expect(result.map((w) => w.name)).toEqual(["BCA", "BRI", "Tanpa id"]);
    expect(new Set(result.map((w) => w.id)).size).toBe(3);
  });

  it("resets a stored type filter that matches nothing", () => {
    const wallets = [{ id: "w1", name: "BCA", type: "bank" }];
    expect(sanitizeFilters(wallets, { query: "", type: "ewallet" })).toMatchObject({
      filters: { type: "all", query: "" },
      changed: true,
    });
  });

  it("renders both fund sources and no empty state after a stale filter is sanitized", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        user: null,
        transactions: [],
        language: "id",
        wallets: [
          { id: "w1", name: "BCA", type: "bank", balance: 1000 },
          { id: "w1", name: "BRI", type: "bank", balance: 2000 },
        ],
      }),
    );
    window.localStorage.setItem(FS_TYPE_KEY, JSON.stringify("ewallet"));
    userEvent.setup();
    render(
      <AppProvider>
        <FundSourceSheet onClose={() => {}} />
      </AppProvider>,
    );

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.getByText("BCA")).toBeInTheDocument();
    expect(screen.getByText("BRI")).toBeInTheDocument();
    expect(screen.queryByTestId("fund-source-empty")).not.toBeInTheDocument();
  });
});
