/**
 * Regression: BCA and BRI must NEVER be merged into a single row, even when
 * the display field (name) is identical or formatted differently. Identity is
 * the wallet id — never the name, type, or a normalized label.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AppProvider, dedupeWallets, type Wallet } from "@/lib/app-store";
import { FundSourceSheet } from "@/routes/settings";

const STORAGE_KEY = "tmab-state-v1";

const seed = (wallets: Wallet[]) =>
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ wallets }));

const rows = () => screen.getAllByTestId(/^fund-source-item-/);

describe("BCA vs BRI identity", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps both banks when the display name is exactly the same", async () => {
    seed([
      { id: "w-bca", name: "Bank Utama", type: "bank", balance: 1000, provider: "BCA" },
      { id: "w-bri", name: "Bank Utama", type: "bank", balance: 2000, provider: "BRI" },
    ]);
    render(
      <AppProvider>
        <FundSourceSheet onClose={() => {}} />
      </AppProvider>,
    );
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.getByTestId("fund-source-item-w-bca")).toBeInTheDocument();
    expect(screen.getByTestId("fund-source-item-w-bri")).toBeInTheDocument();
    expect(screen.queryByTestId("fund-source-empty")).not.toBeInTheDocument();
  });

  it("keeps both banks when only the name formatting differs", async () => {
    seed([
      { id: "w-bca", name: "  bca   utama ", type: "bank", balance: 1000 },
      { id: "w-bri", name: "BCA UTAMA", type: "bank", balance: 2000 },
    ]);
    render(
      <AppProvider>
        <FundSourceSheet onClose={() => {}} />
      </AppProvider>,
    );
    await waitFor(() => expect(rows()).toHaveLength(2));
  });

  it("dedupeWallets never collapses distinct ids with equal display fields", () => {
    const out = dedupeWallets([
      { id: "w-bca", name: "Bank", type: "bank", balance: 0 },
      { id: "w-bri", name: "Bank", type: "bank", balance: 0 },
      { id: "w-bri2", name: "bank", type: "bank", balance: 0 },
    ]);
    expect(out).toHaveLength(3);
    expect(new Set(out.map((w) => w.id)).size).toBe(3);
  });

  it("only collapses genuinely duplicated ids, keeping both entries distinct", () => {
    const out = dedupeWallets([
      { id: "dup", name: "BCA", type: "bank", balance: 10 },
      { id: "dup", name: "BRI", type: "bank", balance: 20 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]!.id).not.toBe(out[1]!.id);
    expect(out.map((w) => w.name).sort()).toEqual(["BCA", "BRI"]);
  });
});
