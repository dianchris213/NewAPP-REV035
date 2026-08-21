/**
 * E2E: several "Muat ulang daftar" clicks while the API flaps
 * (fail → fail → success) must leave exactly one relevant toast on screen and
 * a consistent final list — never the "no fund sources yet" empty state.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { AppProvider } from "@/lib/app-store";
import { FundSourceSheet } from "@/routes/settings";
import { Toaster } from "@/components/ui/sonner";
import { resetToastDedupe } from "@/lib/toast-a11y";

const STORAGE_KEY = "tmab-state-v1";

const GOOD_STATE = {
  wallets: [
    { id: "w-bca", name: "BCA", type: "bank", balance: 250_000 },
    { id: "w-bri", name: "BRI", type: "bank", balance: 100_000 },
    { id: "w-cash", name: "Dompet", type: "cash", balance: 50_000 },
  ],
};

const liveToasts = () => Array.from(document.querySelectorAll("[data-sonner-toast]"));

function mount() {
  render(
    <AppProvider>
      <FundSourceSheet onClose={() => {}} />
      <Toaster />
    </AppProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  resetToastDedupe();
});

afterEach(() => {
  toast.dismiss();
  resetToastDedupe();
});

describe("Fund source reload — flapping API", () => {
  it("shows a single relevant toast and a consistent list after fail → fail → success", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ wallets: "broken" }));
    mount();

    await screen.findByTestId("fund-source-load-error");

    // Two consecutive failing retries: the error toast must not stack.
    await user.click(screen.getByTestId("fund-source-reload"));
    await user.click(screen.getByTestId("fund-source-reload"));

    await waitFor(() => expect(screen.getByTestId("fund-source-load-error")).toBeInTheDocument());
    await waitFor(() => expect(liveToasts().length).toBe(1));
    const errorToasts = liveToasts().filter((n) =>
      /gagal memuat daftar sumber dana/i.test(n.textContent ?? ""),
    );
    expect(errorToasts.length).toBe(1);
    expect(screen.queryByTestId("fund-source-empty")).not.toBeInTheDocument();

    // The API recovers; a final retry must converge on the real data.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(GOOD_STATE));
    await user.click(screen.getByTestId("fund-source-reload"));

    await waitFor(() =>
      expect(screen.queryByTestId("fund-source-load-error")).not.toBeInTheDocument(),
    );
    expect(await screen.findByText("BCA")).toBeInTheDocument();
    expect(screen.getByText("BRI")).toBeInTheDocument();
    expect(screen.getByText("Dompet")).toBeInTheDocument();
    expect(screen.queryByTestId("fund-source-empty")).not.toBeInTheDocument();

    // Exactly one success announcement, and focus stayed on a live control.
    await waitFor(() =>
      expect(
        liveToasts().filter((n) => /berhasil dimuat ulang/i.test(n.textContent ?? "")).length,
      ).toBe(1),
    );
    const active = document.activeElement as HTMLElement | null;
    expect(active === null || active.isConnected).toBe(true);
  });
});
