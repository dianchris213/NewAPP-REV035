import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { parseCategoryInput, parseCategoryName } from "./category-schema";
import { normalizeCategories, normalizeCategoryType } from "./category-filter";
import { persistWallet, WalletApiError } from "./wallet-api";
import { captureApiError } from "./monitoring";
import {
  createBillId,
  DEFAULT_BILL_ICON,
  isBillIcon,

  defaultBillingProfile,
  nextDueDate,
  normalizeBills,
  parseBillDraft,
  parseBillingProfile,
  type Bill,
  type BillDraft,
  type BillingProfile,
} from "./billing";

export type { Bill, BillDraft, BillingProfile } from "./billing";


/**
 * Collision-free id for a new category. `crypto.randomUUID` is used when
 * available; the counter fallback guarantees uniqueness even when several
 * categories are created inside the same millisecond (duplicate ids used to
 * make one row disappear from the list because React keys collided).
 */
let categorySeq = 0;
function createCategoryId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `c${uuid}`;
  categorySeq += 1;
  return `c${Date.now().toString(36)}${categorySeq.toString(36)}`;
}

/** Outcome of a fund-source create: validation, duplicate or transport failure. */
export type WalletAddResult = { ok: true } | { ok: false; reason: "invalid" | "duplicate" | "api" };

type TelegramWebAppUser = {
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

type TelegramGlobal = {
  Telegram?: { WebApp?: { initDataUnsafe?: { user?: TelegramWebAppUser } } };
};

export type TxType = "income" | "expense";

export type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  note: string;
  date: string; // ISO
  pending?: boolean;
  walletId?: string;
};

export type User = {
  name: string;
  handle: string;
  provider: "telegram" | "google";
  avatar?: string;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  time: string;
};

/** Notifications start empty: nothing is announced until the user acts. */
export const defaultNotifications: AppNotification[] = [];

export type TxFilters = {
  month: string;
  week: string; // "all" | "this" | "last"
  type: "all" | "income" | "expense";
  category: string;
  keyword: string;
};

export const defaultTxFilters: TxFilters = {
  month: "all",
  week: "all",
  type: "all",
  category: "all",
  keyword: "",
};

export type Settings = {
  darkTheme: boolean;
  pushNotifications: boolean;
  biometricLock: boolean;
  cloudSync: boolean;
};

export type Language = "id" | "en";

/**
 * Categories are user-owned: the app ships with NONE. A category may be
 * global (walletId undefined) or routed to one specific wallet account.
 */
export type Category = {
  id: string;
  name: string;
  type: TxType;
  walletId?: string;
};

export type WalletType = "cash" | "bank" | "ewallet";

export type Wallet = {
  id: string;
  name: string;
  type: WalletType;
  provider?: string;
  balance: number;
};

export type WalletActivityKind = "topup" | "transfer" | "create" | "rename" | "delete" | "profile";

export type WalletActivity = {
  id: string;
  kind: WalletActivityKind;
  title: string;
  detail: string;
  amount: number;
  date: string; // ISO
};

export const WALLET_TYPE_LABEL: Record<WalletType, string> = {
  cash: "Tunai",
  bank: "Bank Utama",
  ewallet: "E-Wallet",
};

export const WALLET_PROVIDERS: Record<WalletType, string[]> = {
  // Empty by default: sumber dana is created by the user in Pengaturan → Sumber Dana.
  cash: [],
  bank: [],
  ewallet: [],
};

const STORAGE_KEY = "tmab-state-v1";

/**
 * Identity of a "Sumber Dana" (fund source): its type + provider name.
 * Pocket (kantong) names are unique *within* one fund source only, so the same
 * name may be reused under a different fund source.
 */
export function fundSourceKey(input: { type: WalletType; provider?: string | undefined }) {
  return `${input.type}::${(input.provider ?? "").trim().toLowerCase()}`;
}

/**
 * Collision-proof wallet ids. `Date.now()` alone repeats when two fund sources
 * are created inside the same millisecond, which made two distinct rows (e.g.
 * BCA and BRI) share a React key so the second one visually replaced the first.
 */
let walletIdCounter = 0;
export function createWalletId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `w${uuid}`;
  walletIdCounter += 1;
  return `w${Date.now()}-${walletIdCounter}-${Math.round(Math.random() * 1e6)}`;
}

/**
 * Normalizes a persisted wallet list: drops malformed rows and guarantees every
 * id is unique, so restored state can never collapse two distinct fund sources
 * into a single rendered row. Names are NOT used for identity.
 */
export function dedupeWallets(input: readonly unknown[]): Wallet[] {
  const seen = new Set<string>();
  const out: Wallet[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const w = raw as Partial<Wallet>;
    if (typeof w.name !== "string" || !w.name.trim()) continue;
    if (w.type !== "cash" && w.type !== "bank" && w.type !== "ewallet") continue;
    const id = typeof w.id === "string" && w.id.trim() && !seen.has(w.id) ? w.id : createWalletId();
    seen.add(id);
    out.push({
      id,
      name: w.name,
      type: w.type,
      balance: Number.isFinite(w.balance) ? Number(w.balance) : 0,
      ...(typeof w.provider === "string" && w.provider.trim() ? { provider: w.provider } : {}),
    });
  }
  return out;
}

/** Pure duplicate check used by the store and by the forms (and by tests). */
export function isPocketNameTaken(
  wallets: Wallet[],
  input: { name: string; type: WalletType; provider?: string | undefined; ignoreId?: string },
) {
  const name = input.name.trim().replace(/\s+/g, " ").toLowerCase();
  if (!name) return false;
  const key = fundSourceKey(input);
  return wallets.some(
    (w) =>
      w.id !== input.ignoreId && fundSourceKey(w) === key && w.name.trim().toLowerCase() === name,
  );
}

const defaultSettings: Settings = {
  darkTheme: true,
  pushNotifications: false,
  biometricLock: false,
  cloudSync: false,
};

/**
 * Fund sources (Sumber Dana) are user-owned: the app ships with NONE, so a
 * fresh install starts from a clean, honest zero balance.
 */
const seedWallets = (): Wallet[] => [];

const seedWalletActivity = (): WalletActivity[] => [];

/**
 * Transactions are user-owned too: a fresh install (and a fresh login/signup)
 * starts with an empty history, zero balance and no demo rows. Everything has
 * to be entered manually by the user.
 */
const seedTransactions = (): Transaction[] => [];

type AppState = {
  hydrated: boolean;
  user: User | null;
  authLoading: null | "telegram" | "google";
  transactions: Transaction[];
  settings: Settings;
  addTxOpen: boolean;
  allTxOpen: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  markNotificationsRead: () => void;
  updateProfile: (update: { name?: string; avatar?: string }) => Promise<boolean>;
  profileSaving: boolean;
  txFilters: TxFilters;
  setTxFilters: (update: Partial<TxFilters>) => void;
  resetTxFilters: () => void;
  setAllTxOpen: (open: boolean) => void;
  openCurrentMonth: () => void;
  login: (provider: "telegram" | "google", name?: string) => Promise<void>;
  logout: () => void;
  addTransaction: (input: Omit<Transaction, "id" | "date" | "pending"> & { date?: string }) => void;
  updateTransaction: (id: string, patch: Partial<Omit<Transaction, "id">>) => void;
  deleteTransaction: (id: string) => void;
  toggleSetting: (key: keyof Settings) => void;
  setAddTxOpen: (open: boolean) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  categories: Category[];
  addCategory: (input: { name: string; type: TxType; walletId?: string }) => boolean;
  renameCategory: (id: string, name: string) => boolean;
  deleteCategory: (id: string) => boolean;
  categoryUsage: (id: string) => number;
  categoriesFor: (type: TxType, walletId?: string) => Category[];

  /** Tagihan Bulanan: persisted bills + invoice branding profile. */
  bills: Bill[];
  billingProfile: BillingProfile;
  addBill: (draft: BillDraft) => boolean;
  updateBill: (id: string, draft: BillDraft) => boolean;
  deleteBill: (id: string) => boolean;
  /**
   * Marks a bill paid. A recurring bill instead rolls forward to its next due
   * date and stays unpaid, so the schedule is never lost.
   */
  markBillPaid: (id: string) => boolean;
  setBillingProfile: (patch: Partial<BillingProfile>) => void;
  /** Last icon picked in the Tagihan Bulanan sheet; restored on reopen. */
  billIconPref: string;
  setBillIconPref: (icon: string) => void;

  locked: boolean;

  unlockApp: (pin?: string) => boolean;
  lockApp: () => void;
  wallets: Wallet[];
  walletActivity: WalletActivity[];
  addWallet: (input: {
    name: string;
    type: WalletType;
    provider?: string;
    balance: number;
  }) => Promise<WalletAddResult>;
  renameWallet: (id: string, name: string) => Promise<boolean>;
  deleteWallet: (id: string) => Promise<boolean>;
  /** Re-insert a previously deleted fund source (Undo). */
  restoreWallet: (wallet: Wallet) => boolean;
  /**
   * Non-null when the fund-source data could not be read/parsed. The UI must
   * show an explicit error (toast + inline alert) instead of an empty state.
   */
  walletLoadError: string | null;
  /** Re-attempts the fund-source load after a failure. */
  reloadWallets: () => void;
  /** In-flight fund-source mutations, for loading state / optimistic UI. */
  walletPending: { add: boolean; byId: Record<string, "rename" | "delete"> };
  walletUsage: (id: string) => number;
  topUpWallet: (input: { walletId: string; amount: number; source?: string }) => boolean;
  transferBetweenWallets: (input: { fromId: string; toId: string; amount: number }) => boolean;
  balance: number;
  walletBalance: number;
  totalIncome: number;
  totalExpense: number;
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<null | "telegram" | "google">(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [language, setLanguage] = useState<Language>("id");
  const [categories, setCategories] = useState<Category[]>([]);
  const [locked, setLocked] = useState(false);
  const [bills, setBills] = useState<Bill[]>([]);
  const [billingProfile, setBillingProfileState] = useState<BillingProfile>(defaultBillingProfile);
  const [billIconPref, setBillIconPrefState] = useState<string>(DEFAULT_BILL_ICON);

  const setBillIconPref = useCallback((icon: string) => {
    setBillIconPrefState(isBillIcon(icon) ? icon : DEFAULT_BILL_ICON);
  }, []);

  const addBill = useCallback((draft: BillDraft) => {
    const parsed = parseBillDraft(draft);
    if (!parsed) return false;
    setBills((prev) => [
      { ...parsed, id: createBillId(), paid: false, createdAt: new Date().toISOString() },
      ...prev,
    ]);
    return true;
  }, []);

  const updateBill = useCallback((id: string, draft: BillDraft) => {
    const parsed = parseBillDraft(draft);
    if (!id || !parsed) return false;
    let ok = false;
    setBills((prev) =>
      prev.map((bill) => {
        if (bill.id !== id) return bill;
        ok = true;
        return { ...bill, ...parsed, id: bill.id, createdAt: bill.createdAt };
      }),
    );
    return ok;
  }, []);

  const deleteBill = useCallback((id: string) => {
    if (!id) return false;
    let ok = false;
    setBills((prev) => {
      if (!prev.some((bill) => bill.id === id)) return prev;
      ok = true;
      return prev.filter((bill) => bill.id !== id);
    });
    return ok;
  }, []);

  const markBillPaid = useCallback((id: string) => {
    if (!id) return false;
    let ok = false;
    setBills((prev) =>
      prev.map((bill) => {
        if (bill.id !== id) return bill;
        ok = true;
        const rolled = nextDueDate(bill.dueDate, bill.recurring);
        return rolled ? { ...bill, dueDate: rolled, paid: false } : { ...bill, paid: true };
      }),
    );
    return ok;
  }, []);

  const setBillingProfile = useCallback((patch: Partial<BillingProfile>) => {
    setBillingProfileState((prev) => parseBillingProfile({ ...prev, ...patch }));
  }, []);

  const [wallets, setWallets] = useState<Wallet[]>(seedWallets);
  const [walletActivity, setWalletActivity] = useState<WalletActivity[]>(seedWalletActivity);
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [allTxOpen, setAllTxOpen] = useState(false);
  const [txFilters, setTxFiltersState] = useState<TxFilters>(defaultTxFilters);
  const [notifications] = useState<AppNotification[]>(defaultNotifications);
  const [unreadCount, setUnreadCount] = useState(defaultNotifications.length);
  const [walletPending, setWalletPending] = useState<{
    add: boolean;
    byId: Record<string, "rename" | "delete">;
  }>({ add: false, byId: {} });
  const [profileSaving, setProfileSaving] = useState(false);
  const [walletLoadError, setWalletLoadError] = useState<string | null>(null);
  const [loadNonce, setLoadNonce] = useState(0);
  const reloadWallets = useCallback(() => {
    setWalletLoadError(null);
    setLoadNonce((n) => n + 1);
  }, []);

  const addCategory = useCallback((input: { name: string; type: TxType; walletId?: string }) => {
    // Single strict gate: schema-parsed + sanitized before touching state.
    const parsed = parseCategoryInput(input);
    if (!parsed) return false;
    const { name, type, walletId } = parsed;
    let ok = false;
    setCategories((prev) => {
      const duplicate = prev.some(
        (c) =>
          c.type === type &&
          c.name.toLowerCase() === name.toLowerCase() &&
          (c.walletId ?? "") === walletId,
      );
      if (duplicate) return prev;
      ok = true;
      return [
        ...prev,
        {
          id: createCategoryId(),
          name,
          type,
          ...(walletId ? { walletId } : {}),
        },
      ];
    });
    return ok;
  }, []);

  const categoryUsage = useCallback(
    (id: string) => {
      const cat = categories.find((c) => c.id === id);
      if (!cat) return 0;
      return transactions.filter(
        (tx) =>
          tx.type === normalizeCategoryType(cat.type) &&
          tx.category.toLowerCase() === cat.name.toLowerCase() &&
          (!cat.walletId || tx.walletId === cat.walletId),
      ).length;
    },
    [categories, transactions],
  );

  const renameCategory = useCallback((id: string, next: string) => {
    const name = parseCategoryName(next);
    if (!name) return false;
    let ok = false;
    setCategories((prev) => {
      const target = prev.find((c) => c.id === id);
      if (!target) return prev;
      const duplicate = prev.some(
        (c) =>
          c.id !== id &&
          c.type === target.type &&
          c.name.toLowerCase() === name.toLowerCase() &&
          (c.walletId ?? "") === (target.walletId ?? ""),
      );
      if (duplicate) return prev;
      ok = true;
      return prev.map((c) => (c.id === id ? { ...c, name } : c));
    });
    return ok;
  }, []);

  const deleteCategory = useCallback(
    (id: string) => {
      if (!id) return false;
      if (categoryUsage(id) > 0) return false;
      setCategories((prev) => prev.filter((c) => c.id !== id));
      return true;
    },
    [categoryUsage],
  );

  const categoriesFor = useCallback(
    (type: TxType, walletId?: string) =>
      categories.filter(
        (c) =>
          normalizeCategoryType(c.type) === type &&
          (!c.walletId || (!!walletId && c.walletId === walletId)),
      ),
    [categories],
  );

  const unlockApp = useCallback(() => {
    setLocked(false);
    return true;
  }, []);

  const lockApp = useCallback(() => setLocked(true), []);

  const pushActivity = useCallback((activity: Omit<WalletActivity, "id" | "date">) => {
    setWalletActivity((prev) => [
      {
        ...activity,
        id: `wa${Date.now()}${Math.round(Math.random() * 1000)}`,
        date: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, []);

  /** Simulated commit window so optimistic UI can show a real busy state. */
  const settle = () => new Promise<void>((r) => setTimeout(r, 260));

  const markPending = useCallback((id: string, kind: "rename" | "delete" | null) => {
    setWalletPending((prev) => {
      const byId = { ...prev.byId };
      if (kind) byId[id] = kind;
      else delete byId[id];
      return { ...prev, byId };
    });
  }, []);

  const addWallet = useCallback(
    async (input: {
      name: string;
      type: WalletType;
      provider?: string;
      balance: number;
    }): Promise<WalletAddResult> => {
      const name = input.name.trim().replace(/\s+/g, " ");
      // Fund source names require at least 3 characters.
      if (name.length < 3 || name.length > 24) return { ok: false, reason: "invalid" };
      let ok = false;
      const id = createWalletId();
      const wallet: Wallet = {
        id,
        name,
        type: input.type,
        balance: Math.max(0, Math.round(input.balance) || 0),
        ...(input.provider?.trim() ? { provider: input.provider.trim() } : {}),
      };
      setWalletPending((prev) => ({ ...prev, add: true }));
      // Optimistic insert: the card appears instantly. Duplicates are rejected
      // only inside the same Sumber Dana (type + provider).
      setWallets((prev) => {
        if (isPocketNameTaken(prev, { name, type: wallet.type, provider: wallet.provider }))
          return prev;
        ok = true;
        return [...prev, wallet];
      });
      await settle();
      if (!ok) {
        setWalletPending((prev) => ({ ...prev, add: false }));
        return { ok: false, reason: "duplicate" };
      }
      try {
        await persistWallet(wallet);
      } catch (error) {
        // Roll back the optimistic row, keep the form input intact upstream and
        // raise a severity-tagged Sentry issue for the failed write.
        setWallets((prev) => prev.filter((w) => w.id !== wallet.id));
        setWalletPending((prev) => ({ ...prev, add: false }));
        void captureApiError(error, {
          operation: "wallet.add",
          ...(error instanceof WalletApiError ? { status: error.status } : {}),
          context: { walletType: wallet.type },
        });
        return { ok: false, reason: "api" };
      }
      setWalletPending((prev) => ({ ...prev, add: false }));
      pushActivity({
        kind: "create",
        title: "Sumber Dana Dibuat",
        detail: `${wallet.name} · ${WALLET_TYPE_LABEL[wallet.type]}${wallet.provider ? ` · ${wallet.provider}` : ""}`,
        amount: wallet.balance,
      });
      return { ok: true };
    },
    [pushActivity],
  );

  /** How many records still reference this fund source (transactions + categories). */
  const walletUsage = useCallback(
    (id: string) =>
      transactions.filter((tx) => tx.walletId === id).length +
      categories.filter((c) => c.walletId === id).length,
    [categories, transactions],
  );

  const renameWallet = useCallback(
    async (id: string, next: string) => {
      const name = next.trim().replace(/\s+/g, " ");
      if (!id || name.length < 3 || name.length > 24) return false;
      let ok = false;
      let before = "";
      markPending(id, "rename");
      setWallets((prev) => {
        const target = prev.find((w) => w.id === id);
        if (!target) return prev;
        const duplicate = isPocketNameTaken(prev, {
          name,
          type: target.type,
          provider: target.provider,
          ignoreId: id,
        });
        if (duplicate || target.name === name) {
          if (target.name === name) {
            ok = true;
            before = target.name;
          }
          return prev;
        }
        ok = true;
        before = target.name;
        return prev.map((w) => (w.id === id ? { ...w, name } : w));
      });
      await settle();
      markPending(id, null);
      if (ok && before !== name) {
        pushActivity({
          kind: "rename",
          title: "Sumber Dana Diubah",
          detail: `${before} → ${name}`,
          amount: 0,
        });
      }
      return ok;
    },
    [markPending, pushActivity],
  );

  const deleteWallet = useCallback(
    async (id: string) => {
      if (!id) return false;
      if (walletUsage(id) > 0) return false;
      let ok = false;
      let removed: Wallet | undefined;
      markPending(id, "delete");
      setWallets((prev) => {
        removed = prev.find((w) => w.id === id);
        if (!removed) return prev;
        ok = true;
        return prev.filter((w) => w.id !== id);
      });
      await settle();
      markPending(id, null);
      if (ok && removed) {
        pushActivity({
          kind: "delete",
          title: "Sumber Dana Dihapus",
          detail: `${removed.name} · ${WALLET_TYPE_LABEL[removed.type]}`,
          amount: removed.balance,
        });
      }
      return ok;
    },
    [markPending, pushActivity, walletUsage],
  );

  /** Undo support: put a deleted fund source back, unless the name was reused. */
  const restoreWallet = useCallback(
    (wallet: Wallet) => {
      if (!wallet?.id || !wallet.name) return false;
      let ok = false;
      setWallets((prev) => {
        if (
          prev.some((w) => w.id === wallet.id) ||
          isPocketNameTaken(prev, {
            name: wallet.name,
            type: wallet.type,
            provider: wallet.provider,
          })
        )
          return prev;
        ok = true;
        return [...prev, wallet];
      });
      if (ok) {
        pushActivity({
          kind: "create",
          title: "Sumber Dana Dipulihkan",
          detail: `${wallet.name} · ${WALLET_TYPE_LABEL[wallet.type]}`,
          amount: wallet.balance,
        });
      }
      return ok;
    },
    [pushActivity],
  );

  const topUpWallet = useCallback(
    ({ walletId, amount, source }: { walletId: string; amount: number; source?: string }) => {
      const value = Math.round(amount);
      if (!walletId || !Number.isFinite(value) || value <= 0) return false;
      let ok = false;
      setWallets((prev) => {
        const target = prev.find((w) => w.id === walletId);
        if (!target) return prev;
        ok = true;
        return prev.map((w) => (w.id === walletId ? { ...w, balance: w.balance + value } : w));
      });
      if (!ok) return false;
      const target = wallets.find((w) => w.id === walletId);
      pushActivity({
        kind: "topup",
        title: `Isi Saldo ${target?.name ?? "Kantong"}`,
        detail: source?.trim()
          ? `${target?.provider ?? ""} · dari ${source.trim()}`.replace(/^ · /, "")
          : (target?.provider ?? "Top up manual"),
        amount: value,
      });
      return true;
    },
    [pushActivity, wallets],
  );

  const transferBetweenWallets = useCallback(
    ({ fromId, toId, amount }: { fromId: string; toId: string; amount: number }) => {
      const value = Math.round(amount);
      if (!fromId || !toId || fromId === toId) return false;
      if (!Number.isFinite(value) || value <= 0) return false;
      let ok = false;
      setWallets((prev) => {
        const from = prev.find((w) => w.id === fromId);
        const to = prev.find((w) => w.id === toId);
        if (!from || !to || from.balance < value) return prev;
        ok = true;
        return prev.map((w) =>
          w.id === fromId
            ? { ...w, balance: w.balance - value }
            : w.id === toId
              ? { ...w, balance: w.balance + value }
              : w,
        );
      });
      if (!ok) return false;
      const from = wallets.find((w) => w.id === fromId);
      const to = wallets.find((w) => w.id === toId);
      pushActivity({
        kind: "transfer",
        title: "Transfer Antar Kantong",
        detail: `${from?.name ?? "?"} → ${to?.name ?? "?"}`,
        amount: value,
      });
      return true;
    },
    [pushActivity, wallets],
  );

  const markNotificationsRead = useCallback(() => setUnreadCount(0), []);

  /**
   * Single source of truth for the profile. Only the keys present in `update`
   * are touched, and `avatar: ""` is an explicit "remove photo" instruction —
   * so a name-only edit can never wipe or duplicate the avatar.
   */
  const updateProfile = useCallback(
    async (update: { name?: string; avatar?: string }) => {
      let changes: string[] = [];
      let ok = false;
      setProfileSaving(true);
      // Optimistic profile write: header/avatar reflect the change instantly.
      setUser((prev) => {
        if (!prev) return prev;
        const next: User = { ...prev };
        if (typeof update.name === "string" && update.name.trim()) {
          next.name = update.name.trim().slice(0, 40);
        }
        if (typeof update.avatar === "string") {
          const avatar = update.avatar.trim();
          if (avatar) next.avatar = avatar;
          else delete next.avatar;
        }
        if (next.name === prev.name && next.avatar === prev.avatar) return prev;
        ok = true;
        changes = [
          next.name !== prev.name ? `Nama: ${prev.name} → ${next.name}` : "",
          next.avatar !== prev.avatar
            ? next.avatar
              ? "Foto profil diperbarui"
              : "Foto profil dihapus"
            : "",
        ].filter(Boolean);
        return next;
      });
      await settle();
      setProfileSaving(false);
      if (ok) {
        pushActivity({
          kind: "profile",
          title: "Profil Diperbarui",
          detail: changes.join(" · "),
          amount: 0,
        });
      }
      return ok;
    },
    [pushActivity],
  );

  const setTxFilters = useCallback((update: Partial<TxFilters>) => {
    setTxFiltersState((prev) => ({ ...prev, ...update }));
  }, []);

  const resetTxFilters = useCallback(() => setTxFiltersState(defaultTxFilters), []);

  const openCurrentMonth = useCallback(() => {
    setTxFiltersState({
      ...defaultTxFilters,
      month: String(new Date().getMonth()),
    });
    setAllTxOpen(true);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          user?: User | null;
          transactions?: Transaction[];
          settings?: Settings;
          language?: Language;
          wallets?: Wallet[];
          walletActivity?: WalletActivity[];
          categories?: Category[];
          bills?: unknown;
          billingProfile?: unknown;
          billIconPref?: unknown;
        };
        setUser(parsed.user ?? null);
        // Only genuine, user-entered rows are restored — no demo data is
        // injected when the stored history is empty.
        setTransactions(Array.isArray(parsed.transactions) ? parsed.transactions : []);
        setSettings({ ...defaultSettings, ...(parsed.settings ?? {}) });
        if (parsed.language === "id" || parsed.language === "en") setLanguage(parsed.language);
        if (parsed.wallets !== undefined) {
          // A changed/corrupt payload shape is a load failure, never an
          // "empty list": the UI must say so instead of showing empty state.
          if (!Array.isArray(parsed.wallets)) throw new Error("wallets payload is not a list");
          setWallets(dedupeWallets(parsed.wallets));
        }
        if (Array.isArray(parsed.walletActivity)) setWalletActivity(parsed.walletActivity);
        // Legacy/hand-edited rows are normalized (canonical type, unique id)
        // so search + type filtering can never hide a real category.
        if (Array.isArray(parsed.categories))
          setCategories(normalizeCategories<Category>(parsed.categories));
        if (Array.isArray(parsed.bills)) setBills(normalizeBills(parsed.bills));
        if (parsed.billingProfile) setBillingProfileState(parseBillingProfile(parsed.billingProfile));
        if (isBillIcon(parsed.billIconPref)) setBillIconPrefState(parsed.billIconPref);
        if (parsed.settings?.biometricLock) setLocked(true);
      } else {
        setTransactions(seedTransactions());
      }
      setWalletLoadError(null);
    } catch (cause) {
      setTransactions(seedTransactions());
      setWalletLoadError(cause instanceof Error ? cause.message : "wallet load failed");
    }
    setHydrated(true);
  }, [loadNonce]);

  // Persist off the render path and coalesced, so rapid state updates never
  // block the UI with repeated JSON serialization.
  useEffect(() => {
    if (!hydrated) return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            user,
            transactions,
            settings,
            language,
            wallets,
            walletActivity,
            categories,
            bills,
            billingProfile,
            billIconPref,
          }),
        );
      } catch {
        /* ignore quota errors */
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [
    hydrated,
    user,
    transactions,
    settings,
    language,
    wallets,
    walletActivity,
    categories,
    bills,
    billingProfile,
    billIconPref,
  ]);

  // Apply the theme switch to the document so the toggle is visually real.
  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.classList.toggle("theme-light", !settings.darkTheme);
    root.classList.toggle("dark", settings.darkTheme);
  }, [hydrated, settings.darkTheme]);

  const login = useCallback(async (provider: "telegram" | "google", name?: string) => {
    setAuthLoading(provider);
    await new Promise((r) => setTimeout(r, 1200));
    const tgUser = (globalThis as unknown as TelegramGlobal).Telegram?.WebApp?.initDataUnsafe?.user;
    setUser({
      name:
        name ||
        (provider === "telegram"
          ? [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(" ") || "Pengguna Telegram"
          : "Pengguna Google"),
      handle:
        provider === "telegram"
          ? tgUser?.username
            ? `@${tgUser.username}`
            : "@telegram_user"
          : "google@gmail.com",
      provider,
    });
    setAuthLoading(null);
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const addTransaction = useCallback(
    (input: Omit<Transaction, "id" | "date" | "pending"> & { date?: string }) => {
      const id = `t${Date.now()}`;
      const { date, ...rest } = input;
      const iso = (() => {
        if (!date) return new Date().toISOString();
        const d = new Date(date);
        return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      })();
      // Optimistic insert: list + balance update instantly, then confirm.
      setTransactions((prev) => [{ ...rest, id, date: iso, pending: true }, ...prev]);
      if (rest.walletId) {
        const delta = rest.type === "income" ? rest.amount : -rest.amount;
        setWallets((prev) =>
          prev.map((w) => (w.id === rest.walletId ? { ...w, balance: w.balance + delta } : w)),
        );
      }
      setTimeout(() => {
        setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, pending: false } : t)));
      }, 700);
    },
    [],
  );

  const updateTransaction = useCallback((id: string, patch: Partial<Omit<Transaction, "id">>) => {
    if (!id) return;
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t)));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    if (!id) return;
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toggleSetting = useCallback((key: keyof Settings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // App Lock arms/releases the challenge immediately.
      if (key === "biometricLock") setLocked(next.biometricLock);
      return next;
    });
  }, []);

  const { totalIncome, totalExpense } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { totalIncome: income, totalExpense: expense };
  }, [transactions]);

  const walletBalance = useMemo(() => wallets.reduce((sum, w) => sum + w.balance, 0), [wallets]);

  // Stable context value: consumers only re-render when real data changes.
  const value = useMemo<AppState>(
    () => ({
      hydrated,
      user,
      authLoading,
      transactions,
      settings,
      addTxOpen,
      allTxOpen,
      notifications,
      unreadCount,
      markNotificationsRead,
      updateProfile,
      profileSaving,
      txFilters,
      setTxFilters,
      resetTxFilters,
      setAllTxOpen,
      openCurrentMonth,
      login,
      logout,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      toggleSetting,
      setAddTxOpen,
      language,
      setLanguage,
      categories,
      addCategory,
      renameCategory,
      deleteCategory,
      categoryUsage,

      categoriesFor,
      bills,
      billingProfile,
      addBill,
      updateBill,
      deleteBill,
      markBillPaid,
      setBillingProfile,
      billIconPref,
      setBillIconPref,
      locked,
      unlockApp,
      lockApp,
      wallets,
      walletActivity,
      addWallet,
      renameWallet,
      deleteWallet,
      restoreWallet,
      walletLoadError,
      reloadWallets,
      walletPending,
      walletUsage,
      topUpWallet,
      transferBetweenWallets,
      balance: totalIncome - totalExpense,
      walletBalance,
      totalIncome,
      totalExpense,
    }),
    [
      hydrated,
      user,
      authLoading,
      transactions,
      settings,
      addTxOpen,
      allTxOpen,
      notifications,
      unreadCount,
      markNotificationsRead,
      updateProfile,
      profileSaving,
      txFilters,
      setTxFilters,
      resetTxFilters,
      openCurrentMonth,
      login,
      logout,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      toggleSetting,
      language,
      categories,
      addCategory,
      renameCategory,
      deleteCategory,
      categoryUsage,

      categoriesFor,
      bills,
      billingProfile,
      addBill,
      updateBill,
      deleteBill,
      markBillPaid,
      setBillingProfile,
      billIconPref,
      setBillIconPref,
      locked,
      unlockApp,
      lockApp,
      wallets,
      walletActivity,
      addWallet,
      renameWallet,
      deleteWallet,
      restoreWallet,
      walletLoadError,
      reloadWallets,
      walletPending,
      walletUsage,
      topUpWallet,
      transferBetweenWallets,
      walletBalance,
      totalIncome,
      totalExpense,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function formatIDR(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}Rp ${Math.abs(Math.round(value)).toLocaleString("id-ID")}`;
}
