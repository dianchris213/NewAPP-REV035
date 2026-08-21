/**
 * Regression: when the fund-source load fails (API/storage payload shape
 * change), the sheet must show a role="alert" error with a "Muat ulang daftar"
 * action — never the confusing "Belum ada Sumber Dana" empty state.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider } from "@/lib/app-store";
import { FundSourceSheet } from "@/routes/settings";
import { Toaster } from "@/components/ui/sonner";

const STORAGE_KEY = "tmab-state-v1";

function mount() {
  render(
    <AppProvider>
      <FundSourceSheet onClose={() => {}} />
      <Toaster />
    </AppProvider>,
  );
}

describe("Fund source load failure", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows an alert and a reload action instead of an empty state", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ wallets: { bca: {}, bri: {} } }));
    mount();

    const alert = await screen.findByTestId("fund-source-load-error");
    expect(alert).toHaveAttribute("role", "alert");
    expect(screen.queryByTestId("fund-source-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("fund-source-reload")).toBeInTheDocument();
    expect(await screen.findAllByText(/Gagal memuat daftar sumber dana/)).not.toHaveLength(0);
  });

  it("keeps the alert (never the empty state) when the reload still fails", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ wallets: "broken" }));
    mount();

    await screen.findByTestId("fund-source-load-error");
    await user.click(screen.getByTestId("fund-source-reload"));

    expect(await screen.findByTestId("fund-source-load-error")).toBeInTheDocument();
    expect(screen.queryByTestId("fund-source-empty")).not.toBeInTheDocument();
  });
});
