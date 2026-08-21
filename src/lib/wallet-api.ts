/**
 * Persistence boundary for fund sources (Sumber Dana).
 *
 * The app is local-first, but every mutation still goes through this thin
 * "API" seam so that:
 *  - transport failures can be simulated and unit tested deterministically;
 *  - production failures are reported to Sentry with a real severity;
 *  - the UI can roll back optimistic state without losing user input.
 */

export class WalletApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "WalletApiError";
    this.status = status;
  }
}

export type PersistWalletInput = {
  id: string;
  name: string;
  type: string;
  balance: number;
  provider?: string;
};

/**
 * Commits a fund source. Local-first: storage is the source of truth, so the
 * default implementation only guards against a corrupted/unavailable
 * localStorage, which is exactly the failure class we want alerts for.
 */
export async function persistWallet(input: PersistWalletInput): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `tmab-wallet-commit-${input.id}`,
      JSON.stringify({ id: input.id, at: Date.now() }),
    );
    window.localStorage.removeItem(`tmab-wallet-commit-${input.id}`);
  } catch (cause) {
    throw new WalletApiError(
      cause instanceof Error ? cause.message : "Fund source could not be saved",
      507,
    );
  }
}
