/**
 * E2E (keyboard): the toast close button must be reachable and operable with the
 * keyboard only, and the Alt+T hotkey must expose the toast region without
 * hijacking navigation. After closing, focus returns to where the user was.
 *
 * Dummy mode: no seeded data, the harness is purely interactive.
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { toastError } from "@/lib/toast-a11y";

function Harness() {
  return (
    <main>
      <button type="button" data-testid="reload" onClick={() => toastError("Gagal memuat daftar")}>
        Muat ulang daftar
      </button>
      <button type="button" data-testid="next">
        Lanjut
      </button>
      <Toaster />
    </main>
  );
}

const closeButton = () => screen.queryByRole("button", { name: /close|tutup/i });

afterEach(() => {
  toast.dismiss();
});

describe("Toast close button — keyboard access", () => {
  it("is focusable and closes the toast with Enter, returning focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const reload = screen.getByTestId("reload");
    reload.focus();
    await user.keyboard("{Enter}");
    await screen.findByText("Gagal memuat daftar");

    const close = await waitFor(() => {
      const el = closeButton();
      expect(el).toBeTruthy();
      return el!;
    });

    // Focusable without a positive tabIndex hack.
    close.focus();
    expect(close).toHaveFocus();
    expect(Number(close.getAttribute("tabindex") ?? 0)).toBeLessThanOrEqual(0);

    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByText("Gagal memuat daftar")).not.toBeInTheDocument());
    await waitFor(() => expect(reload).toHaveFocus());
  });

  it("closes with Space and keeps the rest of the page navigable via Tab", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const reload = screen.getByTestId("reload");
    reload.focus();
    await user.keyboard("{Enter}");
    await screen.findByText("Gagal memuat daftar");

    const close = await waitFor(() => {
      const el = closeButton();
      expect(el).toBeTruthy();
      return el!;
    });
    close.focus();
    await user.keyboard(" ");
    await waitFor(() => expect(closeButton()).toBeNull());

    await waitFor(() => expect(reload).toHaveFocus());
    await user.tab();
    expect(screen.getByTestId("next")).toHaveFocus();
  });
});

describe("Alt+T hotkey", () => {
  it("reveals the toast region on demand and restores focus after the toast is closed", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const reload = screen.getByTestId("reload");
    reload.focus();
    await user.keyboard("{Enter}");
    await screen.findByText("Gagal memuat daftar");

    // Alt+T moves focus into the toast region (opt-in, never automatic).
    await user.keyboard("{Alt>}t{/Alt}");
    await waitFor(() => {
      const active = document.activeElement as HTMLElement | null;
      expect(active?.closest("[data-sonner-toaster],[data-sonner-toast]")).toBeTruthy();
    });

    const close = closeButton();
    expect(close).toBeTruthy();
    close!.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.queryByText("Gagal memuat daftar")).not.toBeInTheDocument());
    await waitFor(() => expect(reload).toHaveFocus());
    expect(document.activeElement?.isConnected).toBe(true);
  });

  it("does not spawn or disturb anything when pressed with no toast visible", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const next = screen.getByTestId("next");
    next.focus();
    await user.keyboard("{Alt>}t{/Alt}");

    expect(closeButton()).toBeNull();
    expect(next).toHaveFocus();
  });
});
