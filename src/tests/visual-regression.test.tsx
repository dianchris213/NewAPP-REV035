/**
 * Visual regression guard (DOM layout contract) for the delete confirmation
 * dialog and the Undo snackbar. jsdom cannot rasterise pixels, so we snapshot
 * the structural style contract instead: container classes (size, position,
 * z-index, radius), element order/sizes and focus placement. Any layout,
 * sizing or focus regression fails the snapshot.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider, useApp } from "@/lib/app-store";
import { FundSourceSheet, UndoSnackbar } from "@/routes/settings";

function layoutOf(el: HTMLElement) {
  return {
    role: el.getAttribute("role"),
    className: el.className,
    children: Array.from(el.querySelectorAll<HTMLElement>("button")).map((b) => ({
      testId: b.dataset["testid"] ?? null,
      className: b.className,
    })),
  };
}

function Harness() {
  const { wallets } = useApp();
  return (
    <div>
      <FundSourceSheet onClose={() => {}} />
      <span data-testid="wallet-id">{wallets[0]?.id ?? ""}</span>
      <span data-testid="wallet-count">{wallets.length}</span>
    </div>
  );
}

describe("Visual regression — delete dialog & Undo toast", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps the Undo snackbar layout, sizing and focus stable", async () => {
    render(
      <UndoSnackbar
        title="Sumber dana dihapus"
        description="Dompet Utama"
        undoLabel="Urungkan"
        hint="Tekan Enter untuk urungkan, Esc untuk tutup."
        countdownLabel="Urungkan dalam"
        seconds={6}
        onUndo={() => {}}
        onDismiss={() => {}}
      />,
    );

    const snackbar = screen.getByTestId("undo-snackbar");
    expect(layoutOf(snackbar)).toMatchSnapshot("undo-snackbar-layout");
    // Focus must land on Undo so keyboard users can revert immediately.
    expect(screen.getByTestId("undo-action")).toHaveFocus();
    expect(screen.getByTestId("undo-countdown")).toHaveTextContent("Urungkan dalam 6s");
    const progress = snackbar.querySelector<HTMLElement>('[style*="width"]');
    expect(progress?.style.width).toBe("100%");
  });

  it("keeps the delete confirmation dialog layout, sizing and focus stable", async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <Harness />
      </AppProvider>,
    );

    const input = screen.getByTestId("fund-source-name");
    await waitFor(() => expect(input).toBeEnabled());
    await user.type(input, "Dompet Utama");
    await user.click(screen.getByTestId("fund-source-submit"));
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));

    const walletId = screen.getByTestId("wallet-id").textContent!;
    await user.click(screen.getByTestId(`fund-source-delete-${walletId}`));

    const dialog = await screen.findByTestId("fund-source-confirm");
    expect(layoutOf(dialog)).toMatchSnapshot("delete-dialog-layout");
    // Destructive confirm is focused, and the focus trap keeps focus inside.
    await waitFor(() => expect(screen.getByTestId("fund-source-confirm-delete")).toHaveFocus());
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
