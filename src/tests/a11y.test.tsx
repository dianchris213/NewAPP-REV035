/**
 * Automated accessibility checks for the two most interaction-heavy surfaces:
 * the FundSourceSheet (form + list) and the delete confirmation dialog.
 *
 * Two complementary layers:
 *  1. axe-core rule audit (labels, names, roles, contrast-independent rules)
 *  2. explicit focus-trap / focus-return assertions, which axe cannot detect.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { AppProvider } from "@/lib/app-store";
import { FundSourceSheet, UndoSnackbar } from "@/routes/settings";

type User = ReturnType<typeof userEvent.setup>;

async function expectNoA11yViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    // jsdom has no layout engine, so colour-contrast and region rules are noise.
    rules: {
      "color-contrast": { enabled: false },
      region: { enabled: false },
    },
  });
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => n.html),
  }));
  expect(violations).toEqual([]);
}

async function setup() {
  const user = userEvent.setup();
  const { container } = render(
    <AppProvider>
      <FundSourceSheet onClose={() => {}} />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("fund-source-name")).toBeEnabled());
  return { user, container };
}

async function addSource(user: User, name: string) {
  const input = screen.getByTestId("fund-source-name") as HTMLInputElement;
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByTestId("fund-source-submit"));
  await waitFor(() => expect(screen.getByTestId("fund-source-submit")).toBeEnabled());
}

describe("Accessibility — FundSourceSheet", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("has no axe violations when empty and when populated", async () => {
    const { user, container } = await setup();
    await expectNoA11yViolations(container);

    await addSource(user, "Kas Harian");
    await expectNoA11yViolations(container);
  });

  it("labels every control with an accessible name", async () => {
    const { user } = await setup();
    await addSource(user, "Kas Harian");

    expect(screen.getByTestId("fund-source-name")).toHaveAccessibleName();
    expect(screen.getByTestId("fund-source-submit")).toHaveAccessibleName();

    // Row actions must be distinguishable by name, not by position only.
    const del = screen.getAllByTestId(/^fund-source-delete-/)[0] as HTMLButtonElement;
    expect(del).toHaveAccessibleName(/hapus/i);
    expect(del.getAttribute("aria-label")).toMatch(/kas harian/i);
  });

  it("announces validation errors through aria-invalid and a live error message", async () => {
    const { user } = await setup();
    const input = screen.getByTestId("fund-source-name") as HTMLInputElement;
    await user.type(input, "Ka");
    await user.click(screen.getByTestId("fund-source-submit"));

    const error = await screen.findByTestId("fund-source-form-error");
    expect(error).toHaveAttribute("role", "alert");
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
  });
});

describe("Accessibility — delete confirmation dialog", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  async function openDialog() {
    const { user, container } = await setup();
    await addSource(user, "Bank Utama");
    const opener = screen.getAllByTestId(/^fund-source-delete-/)[0] as HTMLButtonElement;
    await user.click(opener);
    const dialog = await screen.findByTestId("fund-source-confirm");
    return { user, container, dialog, opener };
  }

  it("has no axe violations and exposes a modal alertdialog with a name", async () => {
    const { container, dialog } = await openDialog();
    expect(dialog).toHaveAttribute("role", "alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName();
    expect(within(dialog).getByTestId("fund-source-confirm-delete")).toHaveAccessibleName();
    expect(within(dialog).getByTestId("fund-source-confirm-cancel")).toHaveAccessibleName();
    await expectNoA11yViolations(container);
  });

  it("traps focus inside the dialog in both directions", async () => {
    const { user, dialog } = await openDialog();
    const confirm = within(dialog).getByTestId("fund-source-confirm-delete");
    const cancel = within(dialog).getByTestId("fund-source-confirm-cancel");
    await waitFor(() => expect(confirm).toHaveFocus());

    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>("button, [href], input, select, textarea"),
    );
    // Cycle forward through every focusable — focus must never escape the dialog.
    for (let i = 0; i < focusables.length + 1; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    // And backwards.
    for (let i = 0; i < focusables.length + 1; i += 1) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    expect([confirm, cancel]).toContain(document.activeElement);
  });

  it("returns focus to the triggering row action on cancel", async () => {
    const { user, opener } = await openDialog();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByTestId("fund-source-confirm")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(opener).toHaveFocus());
  });
});

describe("Accessibility — Undo snackbar", () => {
  it("is an accessible status region with a named action", async () => {
    const { container } = render(
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
    const action = screen.getByTestId("undo-action");
    expect(action).toHaveAccessibleName(/urungkan/i);
    await waitFor(() => expect(action).toHaveFocus());
    await expectNoA11yViolations(container);
  });
});
