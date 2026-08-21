/**
 * Toast accessibility: an error toast must not steal focus when it appears, and
 * must not leave focus on <body> when it is dismissed or auto-closes.
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { toastError } from "@/lib/toast-a11y";

function Harness() {
  return (
    <>
      <button type="button" onClick={() => toastError("Gagal menyimpan data")}>
        Simpan
      </button>
      <button type="button">Lainnya</button>
      <Toaster />
    </>
  );
}

afterEach(() => {
  toast.dismiss();
});

describe("Error toast accessibility", () => {
  it("does not move focus away from the trigger when the toast appears", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Simpan" });

    await user.click(trigger);

    expect(await screen.findByText("Gagal menyimpan data")).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("exposes a keyboard-reachable close button and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Simpan" });

    await user.click(trigger);
    await screen.findByText("Gagal menyimpan data");

    const close = await waitFor(() => screen.getByRole("button", { name: /close|tutup/i }));
    await user.click(close);

    await waitFor(() => expect(screen.queryByText("Gagal menyimpan data")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("does not hijack focus when the user has already moved on", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Simpan" });
    const other = screen.getByRole("button", { name: "Lainnya" });

    await user.click(trigger);
    await screen.findByText("Gagal menyimpan data");
    other.focus();

    toast.dismiss();
    await waitFor(() => expect(screen.queryByText("Gagal menyimpan data")).not.toBeInTheDocument());
    expect(other).toHaveFocus();
  });
});
