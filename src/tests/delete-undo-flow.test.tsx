import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider, useApp } from "@/lib/app-store";
import { FundSourceSheet } from "@/routes/settings";

/**
 * End-to-end (UI level) coverage of the delete + Undo flow inside the real
 * FundSourceSheet, wired to the real app store: focus, keyboard, and state.
 */
function Harness() {
  const { wallets } = useApp();
  return (
    <div>
      <FundSourceSheet onClose={() => {}} />
      <span data-testid="wallet-count">{wallets.length}</span>
      <span data-testid="wallet-names">{wallets.map((w) => w.name).join("|")}</span>
    </div>
  );
}

type User = ReturnType<typeof userEvent.setup>;

async function setup() {
  const user = userEvent.setup();
  render(
    <AppProvider>
      <Harness />
    </AppProvider>,
  );
  const input = screen.getByTestId("fund-source-name") as HTMLInputElement;
  await waitFor(() => expect(input).toBeEnabled());
  return user;
}

async function addSource(user: User, name: string) {
  const input = screen.getByTestId("fund-source-name") as HTMLInputElement;
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByTestId("fund-source-submit"));
  await waitFor(() => expect(screen.getByTestId("fund-source-submit")).toBeEnabled());
}

function deleteButton(index = 0) {
  return screen.getAllByTestId(/^fund-source-delete-/)[index] as HTMLButtonElement;
}

describe("Delete + Undo end-to-end", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("deletes with Enter, restores with Enter on the undo action, and keeps state consistent", async () => {
    const user = await setup();
    await addSource(user, "Kas Harian");
    expect(screen.getByTestId("wallet-count")).toHaveTextContent("1");

    const opener = deleteButton();
    await user.click(opener);

    const dialog = await screen.findByTestId("fund-source-confirm");
    expect(dialog).toHaveAttribute("role", "alertdialog");
    await waitFor(() => expect(screen.getByTestId("fund-source-confirm-delete")).toHaveFocus());

    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("0"));
    expect(screen.queryByTestId("fund-source-confirm")).not.toBeInTheDocument();

    const undo = await screen.findByTestId("undo-action");
    await waitFor(() => expect(undo).toHaveFocus());
    await user.keyboard("{Enter}");

    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));
    expect(screen.getByTestId("wallet-names")).toHaveTextContent("Kas Harian");
    expect(screen.queryByTestId("undo-snackbar")).not.toBeInTheDocument();
  });

  it("cancels with Escape, returns focus to the row action, and keeps the record", async () => {
    const user = await setup();
    await addSource(user, "Bank Utama");

    const opener = deleteButton();
    await user.click(opener);
    await screen.findByTestId("fund-source-confirm");

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByTestId("fund-source-confirm")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(deleteButton()).toHaveFocus());
    expect(screen.getByTestId("wallet-count")).toHaveTextContent("1");
  });

  it("dismisses the undo toast with Escape and the deletion stays applied", async () => {
    const user = await setup();
    await addSource(user, "Dompet Digital");

    await user.click(deleteButton());
    await screen.findByTestId("fund-source-confirm");
    await user.click(screen.getByTestId("fund-source-confirm-delete"));
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("0"));

    await screen.findByTestId("undo-snackbar");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("undo-snackbar")).not.toBeInTheDocument());
    expect(screen.getByTestId("wallet-count")).toHaveTextContent("0");
  });

  it("rejects a 2-character fund source and accepts 3 characters", async () => {
    const user = await setup();
    await addSource(user, "Ka");
    expect(await screen.findByTestId("fund-source-form-error")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-count")).toHaveTextContent("0");

    await addSource(user, "Kas");
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));
    expect(screen.getByTestId("wallet-names")).toHaveTextContent("Kas");
  });

  it("shows a newly added fund source even when a search filter was active", async () => {
    const user = await setup();
    await addSource(user, "Kas Kecil");
    await user.type(screen.getByTestId("fund-source-search"), "zzz");
    expect(await screen.findByTestId("fund-source-empty")).toBeInTheDocument();

    await addSource(user, "Bank Jago");
    expect(await screen.findByText("Bank Jago")).toBeInTheDocument();
    expect(screen.getByTestId("fund-source-search")).toHaveValue("");
  });
});
