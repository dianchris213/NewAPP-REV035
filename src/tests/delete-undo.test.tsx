import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDeleteDialog, UndoSnackbar } from "@/routes/settings";

/** Opener + dialog harness: mirrors how the sheet mounts/unmounts the dialog. */
function ConfirmHarness({ onConfirm = () => {} }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" data-testid="opener" onClick={() => setOpen(true)}>
        Hapus
      </button>
      {open ? (
        <ConfirmDeleteDialog
          title="Hapus Sumber Dana?"
          body="Kas · tindakan ini permanen"
          cancelLabel="Batal"
          confirmLabel="Ya, hapus"
          busy={false}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            onConfirm();
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function UndoHarness({ onUndo = () => {} }: { onUndo?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" data-testid="opener" onClick={() => setOpen(true)}>
        Hapus
      </button>
      {open ? (
        <UndoSnackbar
          title="Sumber dana dihapus"
          description="Kas"
          undoLabel="Urungkan"
          hint="Tekan Enter untuk mengurungkan, Esc untuk menutup."
          countdownLabel="dalam"
          seconds={6}
          onUndo={() => {
            onUndo();
            setOpen(false);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

describe("ConfirmDeleteDialog", () => {
  it("moves focus to the destructive action on open", async () => {
    const user = userEvent.setup();
    render(<ConfirmHarness />);
    await user.click(screen.getByTestId("opener"));
    await waitFor(() => expect(screen.getByTestId("fund-source-confirm-delete")).toHaveFocus());
  });

  it("confirms on Enter inside the dialog", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmHarness onConfirm={onConfirm} />);
    await user.click(screen.getByTestId("opener"));
    await waitFor(() => expect(screen.getByTestId("fund-source-confirm-delete")).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId("fund-source-confirm")).toBeNull());
  });

  it("cancels on Escape and returns focus to the opener", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmHarness onConfirm={onConfirm} />);
    const opener = screen.getByTestId("opener");
    await user.click(opener);
    await waitFor(() => expect(screen.getByTestId("fund-source-confirm-delete")).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("fund-source-confirm")).toBeNull());
    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("keeps Tab focus trapped inside the dialog", async () => {
    const user = userEvent.setup();
    render(<ConfirmHarness />);
    await user.click(screen.getByTestId("opener"));
    await waitFor(() => expect(screen.getByTestId("fund-source-confirm-delete")).toHaveFocus());
    await user.tab();
    expect(screen.getByTestId("fund-source-confirm")).toContainElement(
      document.activeElement as HTMLElement,
    );
  });
});

describe("UndoSnackbar", () => {
  it("focuses the undo action when it appears", async () => {
    const user = userEvent.setup();
    render(<UndoHarness />);
    await user.click(screen.getByTestId("opener"));
    await waitFor(() => expect(screen.getByTestId("undo-action")).toHaveFocus());
  });

  it("undoes on Enter while the undo action is focused", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(<UndoHarness onUndo={onUndo} />);
    await user.click(screen.getByTestId("opener"));
    await waitFor(() => expect(screen.getByTestId("undo-action")).toHaveFocus());
    await user.keyboard("{Enter}");
    expect(onUndo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId("undo-snackbar")).toBeNull());
  });

  it("dismisses on Escape and returns focus to the opener", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(<UndoHarness onUndo={onUndo} />);
    const opener = screen.getByTestId("opener");
    await user.click(opener);
    await waitFor(() => expect(screen.getByTestId("undo-action")).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("undo-snackbar")).toBeNull());
    expect(onUndo).not.toHaveBeenCalled();
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
