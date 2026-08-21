/**
 * E2E: a toast that auto-closes must restore focus to the control that raised
 * it and must never leave focus on a node that has been detached.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { resetToastDedupe, toastError, toastSuccess } from "@/lib/toast-a11y";

const AUTO_CLOSE_MS = 400;

function Harness() {
  return (
    <main>
      <button
        type="button"
        data-testid="raise-success"
        onClick={() => toastSuccess("Daftar dimuat ulang", { duration: AUTO_CLOSE_MS })}
      >
        Muat ulang daftar
      </button>
      <button
        type="button"
        data-testid="raise-error"
        onClick={() => toastError("Gagal memuat daftar", { duration: AUTO_CLOSE_MS })}
      >
        Coba lagi
      </button>
      <button type="button" data-testid="other">
        Lainnya
      </button>
      <Toaster />
    </main>
  );
}

const liveToasts = () => document.querySelectorAll("[data-sonner-toast]");

beforeEach(() => resetToastDedupe());
afterEach(() => {
  toast.dismiss();
  resetToastDedupe();
});

describe("Toast auto-close focus restoration", () => {
  it("returns focus to the raising control after the toast auto-closes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByTestId("raise-success");

    await user.click(trigger);
    await screen.findByText("Daftar dimuat ulang");

    // Simulate the user tabbing into the toast before it disappears.
    const closeButton = screen.getAllByRole("button", { name: /close|tutup/i })[0];
    closeButton?.focus();

    await waitFor(() => expect(liveToasts().length).toBe(0), { timeout: 4000 });

    await waitFor(() => expect(trigger).toHaveFocus(), { timeout: 2000 });
    const active = document.activeElement as HTMLElement | null;
    expect(active?.isConnected).toBe(true);
    expect(active?.closest("[data-sonner-toast]") ?? null).toBeNull();
  });

  it("does not steal focus when the user moved on before auto-close", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId("raise-error"));
    await screen.findByText("Gagal memuat daftar");

    const other = screen.getByTestId("other");
    other.focus();

    await waitFor(() => expect(liveToasts().length).toBe(0), { timeout: 4000 });
    expect(other).toHaveFocus();
  });
});
