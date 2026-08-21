import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider, useApp } from "@/lib/app-store";
import { FundSourceSheet } from "@/routes/settings";

function Harness() {
  const { wallets, walletActivity, addTransaction } = useApp();
  return (
    <div>
      <FundSourceSheet onClose={() => {}} />
      <span data-testid="wallet-count">{wallets.length}</span>
      <span data-testid="wallet-id">{wallets[0]?.id ?? ""}</span>
      <span data-testid="activity-log">{walletActivity.map((a) => a.title).join("|")}</span>
      <button
        type="button"
        data-testid="use-first-wallet"
        onClick={() => {
          const first = wallets[0];
          if (!first) return;
          addTransaction({
            type: "expense",
            amount: 1000,
            category: "Transport",
            note: "test",
            date: new Date().toISOString(),
            walletId: first.id,
          });
        }}
      >
        use
      </button>
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
  return user;
}

async function addSource(user: ReturnType<typeof userEvent.setup>, name: string) {
  const input = screen.getByTestId("fund-source-name") as HTMLInputElement;
  await waitFor(() => expect(input).toBeEnabled());
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByTestId("fund-source-submit"));
  await waitFor(() => expect(screen.getByTestId("fund-source-submit")).toBeEnabled());
}

describe("Kartu Sumber Dana", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("focuses the name field when the sheet opens", async () => {
    await setup();
    await waitFor(() => expect(screen.getByTestId("fund-source-name")).toHaveFocus());
  });

  it("rejects names shorter than 3 characters", async () => {
    const user = await setup();
    await addSource(user, "A");
    expect(await screen.findByTestId("fund-source-form-error")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-count")).toHaveTextContent("0");
  });

  it("adds a valid fund source and records an audit entry", async () => {
    const user = await setup();
    await addSource(user, "Dompet Utama");
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));
    await waitFor(() =>
      expect(screen.getByTestId("activity-log")).toHaveTextContent("Sumber Dana Dibuat"),
    );
  });

  it("rejects duplicate names (case-insensitive)", async () => {
    const user = await setup();
    await addSource(user, "Dompet Utama");
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));
    await addSource(user, "dompet utama");
    expect(await screen.findByTestId("fund-source-form-error")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-count")).toHaveTextContent("1");
  });

  it("renames a fund source and logs the change", async () => {
    const user = await setup();
    await addSource(user, "Dompet Utama");
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));

    const walletId = screen.getByTestId("wallet-id").textContent!;
    await user.click(screen.getByTestId(`fund-source-rename-${walletId}`));
    const editor = screen.getByTestId(`fund-source-rename-input-${walletId}`);
    await user.clear(editor);
    await user.type(editor, "Dompet Kedua{Enter}");

    await waitFor(() => expect(screen.getByText("Dompet Kedua")).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByTestId("activity-log")).toHaveTextContent("Sumber Dana Diubah"),
    );
  });

  it("deletes an unused fund source", async () => {
    const user = await setup();
    await addSource(user, "Dompet Utama");
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));
    const walletId = screen.getByTestId("wallet-id").textContent!;
    await user.click(screen.getByTestId(`fund-source-delete-${walletId}`));
    expect(await screen.findByTestId("fund-source-confirm")).toBeInTheDocument();
    await user.click(screen.getByTestId("fund-source-confirm-delete"));
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("0"));
    await waitFor(() =>
      expect(screen.getByTestId("activity-log")).toHaveTextContent("Sumber Dana Dihapus"),
    );
  });

  it("blocks deletion while the fund source is in use", async () => {
    const user = await setup();
    await addSource(user, "Dompet Utama");
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));
    await user.click(screen.getByTestId("use-first-wallet"));

    const walletId = screen.getByTestId("wallet-id").textContent!;
    await user.click(screen.getByTestId(`fund-source-delete-${walletId}`));
    expect(screen.queryByTestId("fund-source-confirm")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByTestId("wallet-count")).toHaveTextContent("1");
  });

  it("cancels deletion from the confirmation dialog", async () => {
    const user = await setup();
    await addSource(user, "Dompet Utama");
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));
    const walletId = screen.getByTestId("wallet-id").textContent!;
    await user.click(screen.getByTestId(`fund-source-delete-${walletId}`));
    await user.click(await screen.findByTestId("fund-source-confirm-cancel"));
    await waitFor(() =>
      expect(screen.queryByTestId("fund-source-confirm")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("wallet-count")).toHaveTextContent("1");
  });

  it("filters the list by search keyword and type", async () => {
    const user = await setup();
    await addSource(user, "Dompet Utama");
    await addSource(user, "Kas Kecil");
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("2"));

    await user.type(screen.getByTestId("fund-source-search"), "kas");
    await waitFor(() => expect(screen.queryByText("Dompet Utama")).not.toBeInTheDocument());
    expect(screen.getByText("Kas Kecil")).toBeInTheDocument();

    await user.clear(screen.getByTestId("fund-source-search"));
    await user.selectOptions(screen.getByTestId("fund-source-filter-type"), "bank");
    await waitFor(() => expect(screen.getByTestId("fund-source-empty")).toBeInTheDocument());
  });
});
