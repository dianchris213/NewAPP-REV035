/**
 * Extended Undo-toast end-to-end flow across an API failure.
 *
 * Scenario: the user hits an API error while saving, retries with the
 * preserved input, deletes the resulting fund source and undoes the delete.
 * Input value, list state and focus placement must stay correct at every step.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider, useApp } from "@/lib/app-store";
import { FundSourceSheet } from "@/routes/settings";
import { Toaster } from "@/components/ui/sonner";
import { WalletApiError, persistWallet } from "@/lib/wallet-api";

vi.mock("@/lib/wallet-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wallet-api")>();
  return { ...actual, persistWallet: vi.fn(async () => {}) };
});

vi.mock("@/lib/monitoring", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/monitoring")>();
  return { ...actual, captureApiError: vi.fn(async () => "error" as const) };
});

const persistMock = vi.mocked(persistWallet);

type User = ReturnType<typeof userEvent.setup>;

function Harness() {
  const { wallets } = useApp();
  return (
    <div>
      <FundSourceSheet onClose={() => {}} />
      <Toaster />
      <span data-testid="wallet-count">{wallets.length}</span>
      <span data-testid="wallet-names">{wallets.map((w) => w.name).join("|")}</span>
    </div>
  );
}

async function setup() {
  const user = userEvent.setup();
  render(
    <AppProvider>
      <Harness />
    </AppProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("fund-source-name")).toBeEnabled());
  return user;
}

function nameInput() {
  return screen.getByTestId("fund-source-name") as HTMLInputElement;
}

function deleteButton() {
  return screen.getAllByTestId(/^fund-source-delete-/)[0] as HTMLButtonElement;
}

async function submit(user: User, name?: string) {
  if (name !== undefined) {
    await user.clear(nameInput());
    await user.type(nameInput(), name);
  }
  await user.click(screen.getByTestId("fund-source-submit"));
  await waitFor(() => expect(screen.getByTestId("fund-source-submit")).toBeEnabled());
}

describe("Undo toast after an API error and re-save", () => {
  beforeEach(() => {
    window.localStorage.clear();
    persistMock.mockReset();
    persistMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps input and focus correct through failure -> retry -> delete -> undo", async () => {
    persistMock.mockRejectedValueOnce(new WalletApiError("gateway down", 503));
    const user = await setup();

    // 1. API failure: nothing persisted, input kept, focus back on the field.
    await submit(user, "Kas Cadangan");
    await screen.findByTestId("fund-source-form-error");
    expect(screen.getByTestId("wallet-count")).toHaveTextContent("0");
    expect(nameInput()).toHaveValue("Kas Cadangan");
    await waitFor(() => expect(nameInput()).toHaveFocus());

    // 2. Re-save with the preserved value: succeeds, form resets and refocuses.
    await submit(user);
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));
    await waitFor(() =>
      expect(screen.queryByTestId("fund-source-form-error")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(nameInput()).toHaveValue(""));
    expect(nameInput()).toBeEnabled();
    expect(nameInput()).not.toHaveAttribute("aria-invalid", "true");

    // 3. Delete it — undo toast appears and takes focus.
    const opener = deleteButton();
    await user.click(opener);
    await screen.findByTestId("fund-source-confirm");
    await user.click(screen.getByTestId("fund-source-confirm-delete"));
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("0"));

    const undo = await screen.findByTestId("undo-action");
    await waitFor(() => expect(undo).toHaveFocus());

    // 4. Undo restores the row, dismisses the toast and leaves the form usable.
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));
    expect(screen.getByTestId("wallet-names")).toHaveTextContent("Kas Cadangan");
    expect(screen.queryByTestId("undo-snackbar")).not.toBeInTheDocument();
    expect(nameInput()).toHaveValue("");
    expect(nameInput()).toBeEnabled();
  });

  it("preserves the typed input when the delete-undo cycle happens mid-typing", async () => {
    const user = await setup();
    await submit(user, "Bank Utama");
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));

    // User starts typing the next fund source...
    await user.type(nameInput(), "Dompet Dig");

    // ...then deletes the existing one and undoes it.
    await user.click(deleteButton());
    await screen.findByTestId("fund-source-confirm");
    await user.click(screen.getByTestId("fund-source-confirm-delete"));
    const undo = await screen.findByTestId("undo-action");
    await user.click(undo);
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));

    // The in-progress draft must survive the whole cycle.
    expect(nameInput()).toHaveValue("Dompet Dig");

    // And it can still be saved afterwards.
    await submit(user);
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("2"));
    expect(screen.getByTestId("wallet-names")).toHaveTextContent("Dompet Dig");
  });

  it("rolls back and keeps input when the API fails right after an undo", async () => {
    const user = await setup();
    await submit(user, "Kas Harian");
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));

    await user.click(deleteButton());
    await screen.findByTestId("fund-source-confirm");
    await user.click(screen.getByTestId("fund-source-confirm-delete"));
    await user.click(await screen.findByTestId("undo-action"));
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));

    persistMock.mockRejectedValueOnce(new WalletApiError("gateway down", 500));
    await submit(user, "Bank Jago");

    await screen.findByTestId("fund-source-form-error");
    expect(screen.getByTestId("wallet-count")).toHaveTextContent("1");
    expect(nameInput()).toHaveValue("Bank Jago");
    await waitFor(() => expect(nameInput()).toHaveFocus());
  });
});
