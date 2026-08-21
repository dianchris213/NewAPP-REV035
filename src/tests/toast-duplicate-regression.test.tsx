/**
 * Regression: rapidly repeated identical error/success toasts (double click,
 * retry storm, a request answered twice) must collapse into a SINGLE live
 * toast, and focus must never be parked on a detached node.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { resetToastDedupe, toastError, toastSuccess } from "@/lib/toast-a11y";

const ERROR_MESSAGE = "Gagal memuat daftar";
const SUCCESS_MESSAGE = "Daftar dimuat ulang";

function Harness() {
  return (
    <main>
      <button
        type="button"
        data-testid="burst-error"
        onClick={() => {
          toastError(ERROR_MESSAGE);
          toastError(ERROR_MESSAGE);
          toastError(ERROR_MESSAGE);
        }}
      >
        Muat ulang daftar
      </button>
      <button
        type="button"
        data-testid="burst-success"
        onClick={() => {
          toastSuccess(SUCCESS_MESSAGE);
          toastSuccess(SUCCESS_MESSAGE);
        }}
      >
        Simpan
      </button>
      <Toaster />
    </main>
  );
}

const liveToasts = () => document.querySelectorAll("[data-sonner-toast]");

beforeEach(() => {
  resetToastDedupe();
});

afterEach(() => {
  toast.dismiss();
  resetToastDedupe();
});

describe("Duplicate toast de-duplication", () => {
  it("renders exactly one toast for a burst of identical errors", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByTestId("burst-error");

    await user.click(trigger);
    await screen.findByText(ERROR_MESSAGE);

    await waitFor(() => expect(liveToasts().length).toBe(1));
    expect(screen.getAllByText(ERROR_MESSAGE)).toHaveLength(1);
    expect(trigger).toHaveFocus();
  });

  it("keeps one toast per kind across repeated error and success bursts", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId("burst-error"));
    await screen.findByText(ERROR_MESSAGE);
    await user.click(screen.getByTestId("burst-success"));
    await screen.findByText(SUCCESS_MESSAGE);
    await user.click(screen.getByTestId("burst-error"));

    await waitFor(() => expect(liveToasts().length).toBe(2));
    expect(screen.getAllByText(ERROR_MESSAGE)).toHaveLength(1);
    expect(screen.getAllByText(SUCCESS_MESSAGE)).toHaveLength(1);
  });

  it("never leaves focus on a detached node after a duplicate burst is dismissed", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByTestId("burst-error");

    await user.click(trigger);
    await screen.findByText(ERROR_MESSAGE);
    await user.click(trigger);
    await waitFor(() => expect(liveToasts().length).toBe(1));

    toast.dismiss();
    await waitFor(() => expect(liveToasts().length).toBe(0));

    const active = document.activeElement as HTMLElement | null;
    expect(active === null || active.isConnected).toBe(true);
    expect(active?.closest("[data-sonner-toast]") ?? null).toBeNull();
    expect(trigger).toHaveFocus();
  });
});
