/**
 * Regression: several error/success toasts raised in sequence must keep focus
 * management consistent — focus is never parked on a detached node (a toast
 * that already closed) and never yanked away from where the user is working.
 *
 * Data stays empty by default (dummy mode): the harness owns no state.
 */
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { toastError, toastSuccess } from "@/lib/toast-a11y";

function Harness() {
  return (
    <main>
      <button type="button" data-testid="fail" onClick={() => toastError("Gagal memuat daftar")}>
        Muat ulang daftar
      </button>
      <button type="button" data-testid="ok" onClick={() => toastSuccess("Daftar dimuat ulang")}>
        Simpan
      </button>
      <button type="button" data-testid="other">
        Lainnya
      </button>
      <Toaster />
    </main>
  );
}

const closeButtons = () => screen.queryAllByRole("button", { name: /close|tutup/i });

afterEach(() => {
  toast.dismiss();
});

describe("Sequential toasts — focus consistency", () => {
  it("keeps focus on the trigger across error → success → error", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const fail = screen.getByTestId("fail");
    const ok = screen.getByTestId("ok");

    await user.click(fail);
    await screen.findByText("Gagal memuat daftar");
    expect(fail).toHaveFocus();

    await user.click(ok);
    await screen.findByText("Daftar dimuat ulang");
    expect(ok).toHaveFocus();

    await user.click(fail);
    await waitFor(() =>
      expect(screen.getAllByText("Gagal memuat daftar").length).toBeGreaterThanOrEqual(1),
    );

    expect(fail).toHaveFocus();
    expect(document.activeElement?.isConnected).toBe(true);
  });

  it("never leaves focus on a removed toast when stacked toasts are closed one by one", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const fail = screen.getByTestId("fail");
    const ok = screen.getByTestId("ok");

    await user.click(fail);
    await screen.findByText("Gagal memuat daftar");
    await user.click(ok);
    await screen.findByText("Daftar dimuat ulang");

    await waitFor(() => expect(closeButtons().length).toBeGreaterThanOrEqual(2));

    // Close the toasts from the newest one downwards.
    while (closeButtons().length > 0) {
      const button = closeButtons()[0];
      if (!button) break;
      await user.click(button);
      await waitFor(() => expect(button.isConnected).toBe(false));
      const active = document.activeElement as HTMLElement | null;
      expect(active === null || active.isConnected).toBe(true);
      expect(active?.closest("[data-sonner-toast]") ?? null).toBeNull();
    }

    // Focus landed back on a real, still-mounted control.
    await waitFor(() => expect([fail, ok]).toContain(document.activeElement));
  });

  it("does not disrupt the user who moved elsewhere while toasts close", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId("fail"));
    await screen.findByText("Gagal memuat daftar");
    await user.click(screen.getByTestId("ok"));
    await screen.findByText("Daftar dimuat ulang");

    const other = screen.getByTestId("other");
    other.focus();

    toast.dismiss();
    await waitFor(() => expect(closeButtons()).toHaveLength(0));
    expect(other).toHaveFocus();
  });

  it("has no axe violations while multiple toasts are visible", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    await user.click(screen.getByTestId("fail"));
    await screen.findByText("Gagal memuat daftar");
    await user.click(screen.getByTestId("ok"));
    await screen.findByText("Daftar dimuat ulang");

    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
