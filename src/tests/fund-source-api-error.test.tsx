/**
 * End-to-end flow for an API failure while saving a fund source:
 * clear toast/error messaging, no optimistic row left behind, the typed input
 * is preserved, focus returns to the field, and a severity-tagged Sentry
 * issue is raised.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProvider, useApp } from "@/lib/app-store";
import { FundSourceSheet } from "@/routes/settings";
import { Toaster } from "@/components/ui/sonner";
import { WalletApiError, persistWallet } from "@/lib/wallet-api";
import { captureApiError, severityForStatus } from "@/lib/monitoring";

vi.mock("@/lib/wallet-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/wallet-api")>();
  return { ...actual, persistWallet: vi.fn(async () => {}) };
});

vi.mock("@/lib/monitoring", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/monitoring")>();
  return { ...actual, captureApiError: vi.fn(async () => "error" as const) };
});

const persistMock = vi.mocked(persistWallet);
const captureMock = vi.mocked(captureApiError);

function Harness() {
  const { wallets } = useApp();
  return (
    <div>
      <FundSourceSheet onClose={() => {}} />
      <Toaster />
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
  await waitFor(() => expect(screen.getByTestId("fund-source-name")).toBeEnabled());
  return user;
}

async function submit(user: ReturnType<typeof userEvent.setup>, name: string) {
  const input = screen.getByTestId("fund-source-name") as HTMLInputElement;
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByTestId("fund-source-submit"));
  await waitFor(() => expect(screen.getByTestId("fund-source-submit")).toBeEnabled());
}

describe("Fund source API error handling", () => {
  beforeEach(() => {
    window.localStorage.clear();
    persistMock.mockReset();
    captureMock.mockReset();
    persistMock.mockResolvedValue(undefined);
    captureMock.mockResolvedValue("error");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("maps HTTP status to alert severity", () => {
    expect(severityForStatus(422)).toBe("warning");
    expect(severityForStatus(503)).toBe("error");
    expect(severityForStatus(undefined)).toBe("fatal");
  });

  it("keeps the user input and rolls back state when the save fails", async () => {
    persistMock.mockRejectedValueOnce(new WalletApiError("gateway down", 503));
    const user = await setup();

    await submit(user, "Dompet Utama");

    const error = await screen.findByTestId("fund-source-form-error");
    expect(error).toHaveTextContent(/gagal menyimpan sumber dana/i);

    // Optimistic row rolled back — no phantom fund source.
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("0"));

    // Input preserved and refocused so the user can retry immediately.
    const input = screen.getByTestId("fund-source-name") as HTMLInputElement;
    expect(input).toHaveValue("Dompet Utama");
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toBeEnabled();

    // Toast surfaced with an actionable message.
    expect(await screen.findAllByText(/gagal menyimpan sumber dana/i)).not.toHaveLength(0);

    // Sentry issue raised with the API status for severity based alerting.
    await waitFor(() => expect(captureMock).toHaveBeenCalledTimes(1));
    expect(captureMock.mock.calls[0]?.[1]).toMatchObject({
      operation: "wallet.add",
      status: 503,
    });
  });

  it("recovers on retry without re-typing the name", async () => {
    persistMock.mockRejectedValueOnce(new WalletApiError("gateway down", 503));
    const user = await setup();

    await submit(user, "Kas Kecil");
    await screen.findByTestId("fund-source-form-error");
    expect(screen.getByTestId("fund-source-name")).toHaveValue("Kas Kecil");

    // Retry with the preserved value only — no re-typing.
    await user.click(screen.getByTestId("fund-source-submit"));
    await waitFor(() => expect(screen.getByTestId("wallet-count")).toHaveTextContent("1"));
    await waitFor(() =>
      expect(screen.queryByTestId("fund-source-form-error")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByTestId("fund-source-name")).toHaveValue(""));
    expect(screen.getByText("Kas Kecil")).toBeInTheDocument();
  });
});
