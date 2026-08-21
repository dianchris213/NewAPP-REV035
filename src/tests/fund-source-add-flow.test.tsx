/**
 * End-to-end flow: adding a fund source with the 3-character minimum and
 * verifying that search results filter instantly.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider, useApp } from "@/lib/app-store";
import { FundSourceSheet } from "@/routes/settings";

function Harness() {
  const { wallets } = useApp();
  return (
    <div>
      <FundSourceSheet onClose={() => {}} />
      <span data-testid="wallet-count">{wallets.length}</span>
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
  const input = screen.getByTestId("fund-source-name") as HTMLInputElement;
  await waitFor(() => expect(input).toBeEnabled());
  return { user, input };
}

async function submitName(user: ReturnType<typeof userEvent.setup>, name: string) {
  const input = screen.getByTestId("fund-source-name") as HTMLInputElement;
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByTestId("fund-source-submit"));
  await waitFor(() => expect(screen.getByTestId("fund-source-submit")).toBeEnabled());
}

describe("Fund source add flow (min 3 characters + live search)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("rejects a 2 character name and accepts it once it reaches 3", async () => {
    const { user } = await setup();

    await submitName(user, "Ka");
    expect(await screen.findByTestId("fund-source-form-error")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-count")).toHaveTextContent("0");
    expect(screen.getByTestId("fund-source-name")).toHaveAttribute("aria-invalid", "true");

    await submitName(user, "Kas");
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));
    expect(screen.queryByTestId("fund-source-form-error")).not.toBeInTheDocument();
    expect(screen.getByTestId("fund-source-name")).toHaveValue("");
  });

  it("trims whitespace before applying the 3 character rule", async () => {
    const { user } = await setup();
    await submitName(user, "  Ab  ");
    expect(await screen.findByTestId("fund-source-form-error")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-count")).toHaveTextContent("0");
  });

  it("shows filtered results immediately while typing in the search box", async () => {
    const { user } = await setup();
    await submitName(user, "Dompet Utama");
    await submitName(user, "Kas Kecil");
    await submitName(user, "Bank Gaji");
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("3"));

    const search = screen.getByTestId("fund-source-search");
    await user.type(search, "kas");
    await waitFor(() => expect(screen.getByText("Kas Kecil")).toBeInTheDocument());
    expect(screen.queryByText("Dompet Utama")).not.toBeInTheDocument();
    expect(screen.queryByText("Bank Gaji")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "bank");
    await waitFor(() => expect(screen.queryByText("Kas Kecil")).not.toBeInTheDocument());
    expect(screen.getByText("Bank Gaji")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "zzz");
    expect(await screen.findByTestId("fund-source-empty")).toBeInTheDocument();

    await user.click(screen.getByTestId("fund-source-empty-reset"));
    await waitFor(() => expect(screen.getByText("Dompet Utama")).toBeInTheDocument());
  });
});
