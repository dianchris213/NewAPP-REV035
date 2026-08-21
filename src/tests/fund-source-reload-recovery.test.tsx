/**
 * E2E flow: the fund-source load fails, the user presses "Muat ulang daftar",
 * the refetch succeeds and the real list is rendered — the toast/alert path must
 * never fall back to the "Belum ada Sumber Dana" empty state.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "@/lib/app-store";
import { FundSourceSheet } from "@/routes/settings";
import { Toaster } from "@/components/ui/sonner";

const STORAGE_KEY = "tmab-state-v1";

const GOOD_STATE = {
  wallets: [
    { id: "w-bca", name: "BCA", type: "bank", balance: 250_000 },
    { id: "w-cash", name: "Dompet", type: "cash", balance: 50_000 },
  ],
};

function mount() {
  render(
    <AppProvider>
      <FundSourceSheet onClose={() => {}} />
      <Toaster />
    </AppProvider>,
  );
}

describe('Fund source reload ("Muat ulang daftar")', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("refetches successfully after an API failure and renders the list, never the empty state", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ wallets: "broken" }));
    mount();

    await screen.findByTestId("fund-source-load-error");
    expect(screen.queryByTestId("fund-source-empty")).not.toBeInTheDocument();

    // API recovers between attempts.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(GOOD_STATE));
    await user.click(screen.getByTestId("fund-source-reload"));

    await waitFor(() =>
      expect(screen.queryByTestId("fund-source-load-error")).not.toBeInTheDocument(),
    );
    expect(await screen.findByText("BCA")).toBeInTheDocument();
    expect(screen.getByText("Dompet")).toBeInTheDocument();
    expect(screen.queryByTestId("fund-source-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("fund-source-reload")).not.toBeInTheDocument();

    // Success is announced, and no empty-state copy leaks into the toast layer.
    const toasts = await screen.findAllByText(/berhasil dimuat ulang/i);
    expect(toasts.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Belum ada Sumber Dana/i)).not.toBeInTheDocument();
  });

  it("keeps focus usable after the reload succeeds", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ wallets: { bca: {} } }));
    mount();

    const retry = await screen.findByTestId("fund-source-reload");
    retry.focus();
    expect(retry).toHaveFocus();

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(GOOD_STATE));
    await user.click(retry);

    await waitFor(() =>
      expect(screen.queryByTestId("fund-source-load-error")).not.toBeInTheDocument(),
    );
    // Focus never drops to <body>; it stays inside the sheet.
    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body);
      expect(screen.getByTestId("fund-source-sheet").contains(document.activeElement)).toBe(true);
    });
  });

  it("stays on the error alert (with focus on the retry button) when the reload fails again", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ wallets: "broken" }));
    mount();

    const retry = await screen.findByTestId("fund-source-reload");
    await user.click(retry);

    expect(await screen.findByTestId("fund-source-load-error")).toBeInTheDocument();
    expect(screen.queryByTestId("fund-source-empty")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("fund-source-reload")).toHaveFocus());
  });
});
