import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { toastError, toastSuccess } from "@/lib/toast-a11y";
import { AppShell, TopBar } from "@/components/AppShell";
import { Icon } from "@/components/Icon";
import { ListSkeleton } from "@/components/Skeleton";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import {
  useApp,
  WALLET_TYPE_LABEL,
  formatIDR,
  type Wallet,
  type Category,
  type Language,
  type Settings as SettingsState,
  type TxType,
  type WalletType,
} from "@/lib/app-store";
import {
  parseCategoryInput,
  parseCategoryName,
  toCategoryQuery,
  toCategorySort,
  toCategoryTypeFilter,
  type CategorySortValue,
} from "@/lib/category-schema";
import { isString, usePersistentState } from "@/lib/persistent-filter";
import { filterWallets, parseStoredTypeFilter, sanitizeFilters } from "@/lib/fund-source-filter";
import {
  countCategoriesByType,
  filterCategories,
  sanitizeCategoryFilters,
} from "@/lib/category-filter";
import { FundSourceRow } from "@/components/FundSourceRow";
import { BillingSheet } from "@/components/BillingSheet";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Pengaturan - Catatan Keuangan Mini App" },
      {
        name: "description",
        content: "Atur bahasa, mata uang, tema, notifikasi, keamanan, dan ekspor data keuangan.",
      },
      { property: "og:title", content: "Pengaturan - Catatan Keuangan Mini App" },
      {
        property: "og:description",
        content: "Preferensi aplikasi, keamanan, dan pengelolaan data.",
      },
    ],
  }),
  component: SettingsPage,
});

function Row({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  trailing: React.ReactNode;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className="flex w-full items-center gap-3 border-b border-outline-variant/20 py-3 text-left last:border-0 focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-variant text-primary">
        <Icon name={icon} className="text-[20px]" />
      </span>
      <span className="flex flex-1 flex-col">
        <span className="text-sm font-medium text-on-surface">{title}</span>
        {subtitle ? <span className="text-xs text-on-surface-variant">{subtitle}</span> : null}
      </span>
      {trailing}
    </Wrapper>
  );
}

function Toggle({ id, label }: { id: keyof SettingsState; label: string }) {
  const { settings, toggleSetting } = useApp();
  const on = settings[id];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => toggleSetting(id)}
      className={`h-6 w-11 rounded-full border p-0.5 transition-colors ${
        on
          ? "border-primary bg-primary-container/60"
          : "border-outline-variant/40 bg-surface-variant"
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full transition-transform ${
          on ? "translate-x-5 bg-primary" : "translate-x-0 bg-outline"
        }`}
      />
    </button>
  );
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "id", label: "ID" },
  { value: "en", label: "EN" },
];

function LanguageToggle() {
  const { language, setLanguage } = useApp();
  return (
    <div
      role="radiogroup"
      aria-label="Bahasa aplikasi"
      data-testid="language-toggle"
      className="flex items-center gap-1 rounded-full bg-surface-container p-1"
    >
      {LANGUAGES.map((l) => {
        const active = language === l.value;
        return (
          <button
            key={l.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`language-${l.value}`}
            onClick={() => setLanguage(l.value)}
            className={`h-7 min-w-[42px] rounded-full px-3 text-[12px] font-bold transition-colors focus-visible:ring-2 focus-visible:ring-primary/60 ${
              active
                ? "bg-primary-container/40 text-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

const Chevron = <Icon name="chevron_right" className="text-[20px] text-on-surface-variant" />;

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-stack-lg">
      <h2 className="mb-2 text-label uppercase text-primary">{label}</h2>
      <div className="glass-card rounded-[16px] px-4">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const { user, logout, settings, language, categories, wallets, bills } = useApp();
  const navigate = useNavigate();
  const copy = t(language);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const unpaidBills = bills.filter((bill) => !bill.paid).length;

  return (
    <AppShell topBar={<TopBar eyebrow={copy.settingsEyebrow} title={copy.settingsTitle} />}>
      <div className="gradient-hero flex items-center gap-3 rounded-[24px] p-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-variant text-on-surface-variant">
          <Icon name="person" />
        </span>
        <div className="flex flex-1 flex-col">
          <span className="text-base font-semibold text-on-surface">
            {user?.name ?? copy.notSignedIn}
          </span>
          <span className="text-xs text-on-surface-variant">
            {user
              ? `${copy.signedInVia} ${user.provider === "telegram" ? "Telegram" : "Google"}`
              : copy.profileNotLinked}
          </span>
        </div>
        <span className="rounded-full bg-surface-container-high px-4 py-1.5 text-xs font-semibold text-on-surface">
          {user?.handle ?? "-"}
        </span>
      </div>

      <Group label={copy.groupPreferences}>
        <Row
          icon="language"
          title={copy.language}
          subtitle={copy.languageHint}
          trailing={<LanguageToggle />}
        />
        <Row
          icon="dark_mode"
          title={copy.theme}
          subtitle={settings.darkTheme ? copy.themeOn : copy.themeOff}
          trailing={<Toggle id="darkTheme" label={copy.theme} />}
        />
        <Row
          icon="notifications"
          title={copy.notifications}
          subtitle={settings.pushNotifications ? copy.notificationsOn : copy.notificationsOff}
          trailing={<Toggle id="pushNotifications" label={copy.notifications} />}
        />
      </Group>

      <Group label={copy.groupSecurity}>
        <Row
          icon="fingerprint"
          title={copy.appLock}
          subtitle={settings.biometricLock ? copy.appLockOn : copy.appLockOff}
          trailing={<Toggle id="biometricLock" label={copy.appLock} />}
        />
        {settings.biometricLock ? (
          <p className="pb-3 text-[11px] text-on-surface-variant/70">{copy.appLockNote}</p>
        ) : null}
        <Row
          icon="cloud_sync"
          title={copy.cloudSync}
          subtitle={settings.cloudSync ? copy.cloudSyncOn : copy.cloudSyncOff}
          trailing={<Toggle id="cloudSync" label={copy.cloudSync} />}
        />
      </Group>

      <Group label={copy.groupData}>
        <Row
          icon="category"
          title={copy.categories}
          subtitle={
            categories.length ? `${categories.length} · ${copy.manage}` : copy.categoriesEmpty
          }
          trailing={Chevron}
          onClick={() => setCategoryOpen(true)}
        />
        <Row
          icon="account_balance_wallet"
          title={copy.fundSources}
          subtitle={wallets.length ? `${wallets.length} · ${copy.manage}` : copy.fundSourcesEmpty}
          trailing={Chevron}
          onClick={() => setFundOpen(true)}
        />
        <Row
          icon="receipt_long"
          title="Tagihan Bulanan"
          subtitle={
            bills.length
              ? `${bills.length} tagihan · ${unpaidBills} belum lunas`
              : "Kelola invoice, pajak & pengingat WA"
          }
          trailing={Chevron}
          onClick={() => setBillingOpen(true)}
        />
        <Row
          icon="download"
          title={copy.exportData}
          subtitle={copy.exportHint}
          trailing={Chevron}
        />
      </Group>

      <button
        onClick={() => {
          logout();
          navigate({ to: "/login" });
        }}
        className="mt-stack-lg flex w-full items-center justify-center gap-2 rounded-[16px] bg-surface-container-high py-4 text-base font-semibold text-on-surface"
      >
        <Icon name="logout" className="text-[20px]" /> {copy.logout}
      </button>
      <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-[16px] border border-error/30 py-4 text-base font-semibold text-error">
        <Icon name="delete" className="text-[20px]" /> {copy.deleteAccount}
      </button>

      {categoryOpen ? <CategorySheet onClose={() => setCategoryOpen(false)} /> : null}
      {fundOpen ? <FundSourceSheet onClose={() => setFundOpen(false)} /> : null}
      {billingOpen ? <BillingSheet onClose={() => setBillingOpen(false)} /> : null}
    </AppShell>
  );
}

const WALLET_TYPES: WalletType[] = ["cash", "bank", "ewallet"];
const FS_QUERY_KEY = "tmab-fund-source-query";
const FS_TYPE_KEY = "tmab-fund-source-type";
/**
 * Validator for the persisted FS_TYPE_KEY value. Delegates to
 * parseStoredTypeFilter so any invalid value — corrupt JSON, a removed type, or
 * a changed API vocabulary — falls back to "all" instead of hiding the list.
 */
const isTypeFilter = (value: unknown): value is WalletType | "all" =>
  parseStoredTypeFilter(value) === value;

// Transaction categories reuse the same persisted-filter contract as fund
// sources, so search/filter behaviour is identical on both screens.
const CAT_QUERY_KEY = "tmab-category-query";
const CAT_TYPE_KEY = "tmab-category-type";
// Whether the list is expanded is a user choice, so it survives navigation and
// reloads just like the other filter state. Default: expanded (show everything).
const CAT_EXPANDED_KEY = "tmab-category-expanded";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isCategoryTypeFilter = (value: unknown): value is TxType | "all" =>
  value === "all" || value === "income" || value === "expense";

/**
 * Undo snackbar with a visible countdown. Fully keyboard driven: focus lands on
 * Undo, Enter confirms the undo, Escape dismisses, and focus returns to the
 * element that was active before it appeared.
 */
export function UndoSnackbar({
  title,
  description,
  undoLabel,
  hint,
  countdownLabel,
  seconds = 6,
  onUndo,
  onDismiss,
}: {
  title: string;
  description: string;
  undoLabel: string;
  hint: string;
  countdownLabel: string;
  seconds?: number;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const [left, setLeft] = useState(seconds);
  const undoRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const undoCb = useRef(onUndo);
  const dismissCb = useRef(onDismiss);
  undoCb.current = onUndo;
  dismissCb.current = onDismiss;

  useEffect(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    undoRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        dismissCb.current();
      } else if (e.key === "Enter" && document.activeElement === undoRef.current) {
        e.preventDefault();
        e.stopPropagation();
        undoCb.current();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    const timer = window.setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          dismissCb.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("keydown", onKeyDown, true);
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener?.isConnected) opener.focus?.();
    };
  }, []);

  const pct = Math.max(0, Math.min(100, (left / seconds) * 100));

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label={`${title} · ${description}`}
      data-testid="undo-snackbar"
      className="fixed inset-x-0 bottom-4 z-[200] mx-auto w-[min(92vw,26rem)] overflow-hidden rounded-[18px] border border-outline-variant/25 bg-surface-container-high p-4 shadow-2xl"
    >
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-bold text-on-surface">{title}</span>
          <span className="truncate text-[11px] text-on-surface-variant/80">{description}</span>
        </span>
        <span
          data-testid="undo-countdown"
          aria-hidden="true"
          className="shrink-0 text-[11px] font-semibold tabular-nums text-on-surface-variant"
        >
          {`${countdownLabel} ${left}s`}
        </span>
        <button
          type="button"
          ref={undoRef}
          data-testid="undo-action"
          onClick={onUndo}
          className="shrink-0 rounded-full bg-primary-container/40 px-4 py-2 text-[12px] font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          {undoLabel}
        </button>
        <button
          type="button"
          aria-label="Tutup"
          data-testid="undo-dismiss"
          onClick={onDismiss}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-variant text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <Icon name="close" className="text-[16px]" />
        </button>
      </div>
      <p className="mt-2 mb-0 text-[10px] text-on-surface-variant/70">{hint}</p>
      <span aria-hidden="true" className="mt-2 block h-1 rounded-full bg-surface-variant">
        <span
          className="block h-1 rounded-full bg-primary transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
}

/** Manage user-owned fund sources (Sumber Dana). Empty by default. */
export function FundSourceSheet({ onClose }: { onClose: () => void }) {
  const {
    hydrated,
    language,
    wallets,
    addWallet,
    renameWallet,
    deleteWallet,
    restoreWallet,
    walletUsage,
    walletPending,
    walletLoadError,
    reloadWallets,
  } = useApp();
  const copy = t(language);
  const ref = useModalA11y<HTMLDivElement>(true, onClose);
  const [name, setName] = useState("");
  const [type, setType] = useState<WalletType>("cash");
  const [error, setError] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [status, setStatus] = useState("");
  const [query, setQuery, resetQuery, queryRestored] = usePersistentState<string>(
    FS_QUERY_KEY,
    "",
    isString,
  );
  const [typeFilter, setTypeFilter, resetTypeFilter, typeRestored] = usePersistentState<
    WalletType | "all"
  >(FS_TYPE_KEY, "all", isTypeFilter);
  const rowPending = walletPending.byId;

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [undoTarget, setUndoTarget] = useState<Wallet | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const filtersDirty = !!query.trim() || typeFilter !== "all";
  const [filterNotice, setFilterNotice] = useState("");
  // Filters the user changed in this session are respected as-is; only values
  // restored from storage are validated against the loaded wallets.
  const [filterTouched, setFilterTouched] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const resetFilters = useCallback(() => {
    resetQuery();
    resetTypeFilter();
    setFilterNotice(copy.filtersResetAll);
  }, [resetQuery, resetTypeFilter, copy.filtersResetAll]);

  const list = useMemo(
    () =>
      filterWallets(wallets, { query, type: typeFilter }).sort(
        (a, b) =>
          WALLET_TYPES.indexOf(a.type) - WALLET_TYPES.indexOf(b.type) ||
          a.name.localeCompare(b.name),
      ),
    [wallets, query, typeFilter],
  );

  // Hydration validation: persisted filters that cannot match any loaded
  // wallet are discarded so no fund source is ever silently hidden. The
  // sanitizer is idempotent, so this runs on every data/filter change without
  // needing a one-shot ref and without looping.
  useEffect(() => {
    if (!hydrated || !queryRestored || !typeRestored || filterTouched) return;
    const result = sanitizeFilters(wallets, { query, type: typeFilter });
    if (!result.changed) return;
    if (result.filters.type !== typeFilter) resetTypeFilter();
    if (result.filters.query !== query) resetQuery();
    setFilterNotice(copy.filtersResetAll);
  }, [
    hydrated,
    queryRestored,
    typeRestored,
    wallets,
    typeFilter,
    query,
    filterTouched,
    resetQuery,
    resetTypeFilter,
    copy.filtersResetAll,
  ]);

  const hiddenCount = wallets.length - list.length;
  const filtersReady = queryRestored && typeRestored;

  const confirmTarget = confirmId ? (wallets.find((w) => w.id === confirmId) ?? null) : null;

  const announce = (message: string, ok: boolean) => {
    setStatus(message);
    if (ok) toastSuccess(message);
    else toastError(message);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (walletPending.add) return;
    const trimmed = name.trim().replace(/\s+/g, " ");
    const duplicate = wallets.some(
      (w) => w.type === type && w.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (trimmed.length < 3 || trimmed.length > 24 || duplicate) {
      setError(copy.invalidFundSource);
      announce(copy.invalidFundSource, false);
      return;
    }
    const result = await addWallet({ name: trimmed, type, balance: 0 });
    if (!result.ok) {
      if (result.reason === "api") {
        setError(copy.fundSourceSaveFailed);
        setStatus(copy.fundSourceSaveFailed);
        toastError(copy.fundSourceSaveFailed, {
          description: copy.fundSourceSaveFailedHint,
        });
      } else {
        setError(copy.invalidFundSource);
        announce(copy.invalidFundSource, false);
      }
      window.setTimeout(() => nameRef.current?.focus(), 0);
      return;
    }
    setName("");
    setError(undefined);
    if (filtersDirty) resetFilters();
    announce(copy.fundSourceAdded, true);
  };

  const commitRename = async (id: string) => {
    if (walletPending.byId[id]) return;
    if (!(await renameWallet(id, editingName))) {
      setRowError({ id, message: copy.invalidFundSource });
      announce(copy.invalidFundSource, false);
      return;
    }
    setEditingId(null);
    setEditingName("");
    setRowError(null);
    announce(copy.fundSourceRenamed, true);
  };

  // Stable row callbacks: FundSourceRow is memoized, so identity-stable
  // handlers keep re-renders scoped to the row that actually changed.
  const commitRenameRef = useRef(commitRename);
  commitRenameRef.current = commitRename;
  const usageRef = useRef(walletUsage);
  usageRef.current = walletUsage;
  const inUseMessageRef = useRef(copy.fundSourceInUse);
  inUseMessageRef.current = copy.fundSourceInUse;

  const startRename = useCallback((id: string, current: string) => {
    setEditingId(id);
    setEditingName(current);
    setRowError(null);
  }, []);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setRowError(null);
  }, []);

  const handleCommitRename = useCallback((id: string) => {
    void commitRenameRef.current(id);
  }, []);

  const requestDelete = useCallback((id: string) => {
    setRowError(null);
    if (usageRef.current(id) > 0) {
      const message = inUseMessageRef.current;
      setRowError({ id, message });
      setStatus(message);
      toastError(message);
      return;
    }
    setConfirmId(id);
  }, []);

  // Reload ("Muat ulang daftar"): re-runs the fetch, announces the outcome and
  // keeps keyboard focus inside the sheet — the retry button unmounts on
  // success, which would otherwise drop focus to <body>.
  const loadErrorRef = useRef(walletLoadError);
  loadErrorRef.current = walletLoadError;
  const reloadRef = useRef<HTMLButtonElement | null>(null);

  const handleReload = useCallback(() => {
    reloadWallets();
    window.setTimeout(() => {
      if (loadErrorRef.current) {
        // Still failing: the load-error effect re-announces it; keep focus on
        // the retry control so the user can try again immediately.
        reloadRef.current?.focus({ preventScroll: true });
        return;
      }
      setStatus(copy.fundSourceReloaded);
      toastSuccess(copy.fundSourceReloaded);
      nameRef.current?.focus({ preventScroll: true });
    }, 0);
  }, [reloadWallets, copy.fundSourceReloaded]);

  // A failed load must be announced loudly (toast + inline alert), once per
  // failure, and must never be confused with "no fund sources yet".
  useEffect(() => {
    if (!hydrated || !walletLoadError) return;
    toastError(copy.fundSourceLoadFailed, { description: copy.fundSourceLoadFailedHint });
    setStatus(copy.fundSourceLoadFailed);
  }, [hydrated, walletLoadError, copy.fundSourceLoadFailed, copy.fundSourceLoadFailedHint]);

  const remove = async (id: string) => {
    if (walletPending.byId[id]) return;
    const target = wallets.find((w) => w.id === id);
    if (!target || walletUsage(id) > 0) {
      setConfirmId(null);
      setRowError({ id, message: copy.fundSourceInUse });
      announce(copy.fundSourceInUse, false);
      return;
    }
    setConfirmId(null);
    if (!(await deleteWallet(id))) {
      setRowError({ id, message: copy.fundSourceInUse });
      announce(copy.fundSourceInUse, false);
      return;
    }
    setRowError(null);
    setStatus(copy.fundSourceDeleted);
    setUndoTarget(target);
  };

  const undoDelete = () => {
    const target = undoTarget;
    setUndoTarget(null);
    if (!target) return;
    const restored = restoreWallet(target);
    setStatus(restored ? copy.fundSourceRestored : copy.fundSourceRestoreFailed);
    if (restored) toastSuccess(copy.fundSourceRestored, { description: target.name });
    else toastError(copy.fundSourceRestoreFailed);
  };

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fund-source-title"
        aria-describedby="fund-source-hint"
        data-testid="fund-source-sheet"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[26px] border-t border-outline-variant/20 bg-surface-container-high p-5 pb-[calc(env(safe-area-inset-bottom,0px)+120px)] shadow-2xl"
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-3 block h-1 w-10 rounded-full bg-outline-variant/60"
        />
        <div className="flex items-center justify-between">
          <h3 id="fund-source-title" className="m-0 text-title text-on-surface">
            {copy.fundSources}
          </h3>
          <button
            type="button"
            aria-label={copy.close}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-variant text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <form className="mt-4 flex flex-col gap-3" onSubmit={submit} noValidate>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-on-surface-variant/80">{copy.fundSourceType}</span>
            <select
              value={type}
              data-testid="fund-source-type"
              onChange={(e) => setType(e.target.value as WalletType)}
              className="h-12 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {WALLET_TYPES.map((wt) => (
                <option key={wt} value={wt}>
                  {WALLET_TYPE_LABEL[wt]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-on-surface-variant/80">{copy.fundSourceName}</span>
            <input
              value={name}
              minLength={3}
              maxLength={24}
              required
              autoComplete="off"
              data-autofocus
              data-testid="fund-source-name"
              ref={nameRef}
              aria-invalid={!!error}
              aria-errormessage={error ? "fund-source-error" : undefined}
              aria-describedby="fund-source-hint"
              disabled={walletPending.add}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(undefined);
              }}
              className="h-12 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          </label>
          <p id="fund-source-hint" className="m-0 text-[11px] text-on-surface-variant/70">
            {copy.fundSourceHint}
          </p>
          {error ? (
            <p
              id="fund-source-error"
              role="alert"
              data-testid="fund-source-form-error"
              className="m-0 text-[11px] font-semibold text-error"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            data-testid="fund-source-submit"
            disabled={walletPending.add}
            aria-busy={walletPending.add}
            className="gradient-primary flex h-12 items-center justify-center gap-2 rounded-full text-[13px] font-bold text-on-primary-container transition-transform active:scale-95 disabled:opacity-60"
          >
            {walletPending.add ? (
              <Icon name="progress_activity" className="animate-spin text-[18px]" />
            ) : null}
            {walletPending.add ? copy.saving : copy.addFundSource}
          </button>
        </form>

        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {status}
        </p>

        {filterNotice ? (
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="fund-source-filter-reset-notice"
            className="mt-2 m-0 rounded-2xl bg-surface-container px-4 py-2 text-[11px] font-semibold text-on-surface-variant"
          >
            {filterNotice}
          </p>
        ) : null}

        {wallets.length ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="search"
              value={query}
              maxLength={40}
              autoComplete="off"
              placeholder={copy.searchFundSources}
              aria-label={copy.searchFundSources}
              data-testid="fund-source-search"
              onChange={(e) => {
                setFilterNotice("");
                setFilterTouched(true);
                setQuery(toCategoryQuery(e.target.value));
              }}
              className="h-11 min-w-0 flex-1 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[13px] text-on-surface outline-none placeholder:text-on-surface-variant/50 focus-visible:ring-2 focus-visible:ring-primary/60"
            />
            <select
              value={typeFilter}
              aria-label={copy.fundSourceType}
              data-testid="fund-source-filter-type"
              onChange={(e) => {
                setFilterNotice("");
                setFilterTouched(true);
                setTypeFilter(e.target.value as WalletType | "all");
              }}
              className="h-11 rounded-2xl border border-outline-variant/30 bg-surface-container px-3 text-[13px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:w-40"
            >
              <option value="all">{copy.allTypes}</option>
              {WALLET_TYPES.map((wt) => (
                <option key={wt} value={wt}>
                  {WALLET_TYPE_LABEL[wt]}
                </option>
              ))}
            </select>
            {filtersDirty ? (
              <button
                type="button"
                data-testid="fund-source-reset-filter"
                onClick={resetFilters}
                className="h-11 shrink-0 rounded-2xl border border-outline-variant/30 px-4 text-[12px] font-semibold text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {copy.resetFilter}
              </button>
            ) : null}
          </div>
        ) : null}

        {wallets.length && filtersReady && hiddenCount > 0 ? (
          <p
            role="status"
            aria-live="polite"
            data-testid="fund-source-filter-summary"
            className="mt-2 m-0 rounded-2xl bg-surface-container px-4 py-2 text-[11px] font-semibold text-on-surface-variant"
          >
            {`${list.length}/${wallets.length} · ${copy.resetFilter}`}
          </p>
        ) : null}

        {!hydrated ? (
          <div className="mt-4 rounded-2xl bg-surface-container px-4 py-2">
            <ListSkeleton rows={3} label={copy.loadingFundSources} testId="fund-source-skeleton" />
          </div>
        ) : walletLoadError ? (
          // Load failure is NOT an empty list: never render the empty state
          // here, or the user would think their fund sources were deleted.
          <div
            role="alert"
            data-testid="fund-source-load-error"
            className="mt-4 flex flex-col items-start gap-2 rounded-2xl border border-error/30 bg-error/10 px-4 py-4"
          >
            <span className="flex items-center gap-2 text-[13px] font-bold text-error">
              <Icon name="error" className="text-[18px]" aria-hidden="true" />
              {copy.fundSourceLoadFailed}
            </span>
            <span className="text-[11px] text-on-surface-variant/80">
              {copy.fundSourceLoadFailedHint}
            </span>
            <button
              type="button"
              ref={reloadRef}
              data-testid="fund-source-reload"
              onClick={handleReload}
              className="mt-1 rounded-full border border-outline-variant/30 bg-surface-container px-4 py-2 text-[12px] font-bold text-on-surface focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {copy.retryLoadFundSources}
            </button>
          </div>
        ) : (
          <ul
            aria-label={copy.fundSources}
            aria-busy={walletPending.add}
            className="mt-4 list-none rounded-2xl bg-surface-container px-4 py-1"
          >
            {list.length ? (
              list.map((w, index) => (
                // Keyed by the wallet's unique id only: names/types are not
                // unique, so keying on them made a second row (e.g. BRI)
                // overwrite the first (BCA) on render.
                <FundSourceRow
                  key={w.id}
                  wallet={w}
                  used={walletUsage(w.id)}
                  editing={editingId === w.id}
                  editingName={editingId === w.id ? editingName : ""}
                  message={rowError && rowError.id === w.id ? rowError.message : null}
                  pending={rowPending[w.id]}
                  copy={copy}
                  showTypeHeader={index === 0 || list[index - 1]!.type !== w.type}
                  onStartRename={startRename}
                  onEditingNameChange={setEditingName}
                  onCommitRename={handleCommitRename}
                  onCancelRename={cancelRename}
                  onRequestDelete={requestDelete}
                />
              ))
            ) : (
              <li
                data-testid="fund-source-empty"
                className="flex flex-col items-center gap-3 px-3 py-6 text-center"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-variant text-primary">
                  <Icon name="account_balance_wallet" className="text-[22px]" />
                </span>
                <span className="text-[13px] font-bold text-on-surface">
                  {wallets.length ? copy.noFundSourceResults : copy.emptyFundSourceTitle}
                </span>
                <span className="text-[11px] text-on-surface-variant/80">
                  {wallets.length ? copy.emptyTypeHint : copy.emptyFundSourceBody}
                </span>
                {wallets.length ? (
                  <button
                    type="button"
                    data-testid="fund-source-empty-reset"
                    onClick={resetFilters}
                    className="rounded-full border border-outline-variant/30 px-4 py-2 text-[12px] font-semibold text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    {copy.resetFilter}
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="fund-source-empty-cta"
                    onClick={() => nameRef.current?.focus()}
                    className="gradient-primary rounded-full px-5 py-2.5 text-[12px] font-bold text-on-primary-container focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    {copy.addFundSource}
                  </button>
                )}
              </li>
            )}
          </ul>
        )}

        {confirmTarget ? (
          <ConfirmDeleteDialog
            title={copy.confirmDeleteFundSourceTitle}
            body={`${confirmTarget.name} · ${copy.confirmDeleteFundSourceBody}`}
            cancelLabel={copy.cancel}
            confirmLabel={copy.confirmDelete}
            busy={!!walletPending.byId[confirmTarget.id]}
            onCancel={() => setConfirmId(null)}
            onConfirm={() => void remove(confirmTarget.id)}
          />
        ) : null}

        {undoTarget ? (
          <UndoSnackbar
            title={copy.fundSourceDeleted}
            description={undoTarget.name}
            undoLabel={copy.undo}
            hint={copy.undoHint}
            countdownLabel={copy.undoIn}
            onUndo={undoDelete}
            onDismiss={() => setUndoTarget(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Destructive confirmation with a real focus trap: Escape cancels, Enter
 * confirms, and focus returns to the row's delete button afterwards.
 */
export function ConfirmDeleteDialog({
  title,
  body,
  cancelLabel,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useModalA11y<HTMLDivElement>(true, onCancel);
  return (
    <div
      className="fixed inset-0 z-[190] flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="fund-source-confirm-title"
        aria-describedby="fund-source-confirm-body"
        data-testid="fund-source-confirm"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy) {
            e.preventDefault();
            e.stopPropagation();
            onConfirm();
          }
        }}
        className="w-full max-w-sm rounded-[22px] border border-outline-variant/20 bg-surface-container-high p-5 shadow-2xl"
      >
        <h4 id="fund-source-confirm-title" className="m-0 text-[15px] font-bold text-on-surface">
          {title}
        </h4>
        <p id="fund-source-confirm-body" className="mt-2 text-[12px] text-on-surface-variant/80">
          {body}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            data-testid="fund-source-confirm-cancel"
            onClick={onCancel}
            className="h-11 flex-1 rounded-full bg-surface-variant text-[13px] font-semibold text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-autofocus
            data-testid="fund-source-confirm-delete"
            disabled={busy}
            onClick={onConfirm}
            className="h-11 flex-1 rounded-full border border-error/40 bg-error/15 text-[13px] font-bold text-error focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type CategorySort = CategorySortValue;

const CATEGORY_SORTS: CategorySort[] = ["name-asc", "name-desc", "most-used"];

/** Manage user-owned transaction categories (empty by default). */
/** Rows shown before the user filters or expands the category list. */
const COLLAPSED_CATEGORY_ROWS = 3;

export function CategorySheet({ onClose }: { onClose: () => void }) {
  const {
    language,
    categories,
    addCategory,
    renameCategory,
    deleteCategory,
    categoryUsage,
    wallets,
  } = useApp();
  const copy = t(language);
  const ref = useModalA11y<HTMLDivElement>(true, onClose);
  const [type, setType] = useState<TxType>("expense");
  const [name, setName] = useState("");
  const [walletId, setWalletId] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [status, setStatus] = useState("");
  // Search and the list's type filter are independent of the income/expense
  // tabs above: the tabs choose the type of the category being *created*.
  // Coupling them made search look broken — typing the name of an expense
  // category while the income tab was active returned nothing.
  const [query, setQuery, resetQuery, queryRestored] = usePersistentState<string>(
    CAT_QUERY_KEY,
    "",
    isString,
  );
  const [typeFilter, setTypeFilter, resetTypeFilter, typeRestored] = usePersistentState<
    TxType | "all"
  >(CAT_TYPE_KEY, "all", isCategoryTypeFilter);
  const [sort, setSort] = useState<CategorySort>("name-asc");
  const [filterNotice, setFilterNotice] = useState("");
  // Only filters restored from storage are validated against the loaded data;
  // filters the user changed in this session are respected as-is.
  const [filterTouched, setFilterTouched] = useState(false);
  // Bug fix: the list used to start collapsed, so "Semua Jenis (5)" showed only
  // 3 rows with no indication that rows were hidden. It now starts expanded and
  // the collapsed preview always states how many of how many rows are shown.
  const [expanded, setExpanded] = usePersistentState<boolean>(CAT_EXPANDED_KEY, true, isBoolean);

  const filtersDirty = !!query.trim() || typeFilter !== "all";

  const resetFilters = useCallback(() => {
    resetQuery();
    resetTypeFilter();
    setFilterNotice(copy.filtersResetAll);
  }, [resetQuery, resetTypeFilter, copy.filtersResetAll]);

  const list = useMemo(() => {
    // Category-specific filter: normalizes stored type values (legacy
    // "Pemasukan"/"masuk" payloads) before comparing, so filtering by Jenis
    // always matches the rows the user can see.
    const rows = filterCategories(categories, { query, type: typeFilter });
    return [...rows].sort((a, b) => {
      if (sort === "name-desc") return b.name.localeCompare(a.name);
      if (sort === "most-used") {
        const diff = categoryUsage(b.id) - categoryUsage(a.id);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [categories, categoryUsage, query, sort, typeFilter]);

  // Root cause of "3 categories exist but only 2 are listed": a persisted
  // type filter (e.g. "expense") kept hiding the other categories with no
  // visible control to clear it. The filter is now rendered *and* a stored
  // value that hides data is sanitized back to "all".
  useEffect(() => {
    if (!queryRestored || !typeRestored || filterTouched) return;
    const result = sanitizeCategoryFilters(categories, { query, type: typeFilter });
    if (!result.changed) return;
    if (result.filters.type !== typeFilter) resetTypeFilter();
    if (result.filters.query !== query) resetQuery();
    setFilterNotice(copy.filtersResetAll);
  }, [
    queryRestored,
    typeRestored,
    categories,
    query,
    typeFilter,
    filterTouched,
    resetQuery,
    resetTypeFilter,
    copy.filtersResetAll,
  ]);

  // Per-Jenis counts (search-aware) so each option shows exactly how many rows
  // it will reveal: Pemasukan (3) / Pengeluaran (5) / Semua Jenis (8).
  const counts = useMemo(() => countCategoriesByType(categories, query), [categories, query]);

  // Space saver: with no active filter the list stays collapsed to a short
  // preview; picking a Jenis (or searching) reveals the full matching set.
  const collapsed = !filtersDirty && !expanded;
  const visibleList = collapsed ? list.slice(0, COLLAPSED_CATEGORY_ROWS) : list;

  const hiddenCount = categories.length - list.length;
  const filtersReady = queryRestored && typeRestored;

  const startRename = (id: string, current: string) => {
    setEditingId(id);
    setEditingName(current);
    setRowError(null);
  };

  const announce = (message: string, ok: boolean) => {
    setStatus(message);
    if (ok) toastSuccess(message);
    else toastError(message);
  };

  const commitRename = (id: string) => {
    const clean = parseCategoryName(editingName);
    const ok = clean !== null && renameCategory(id, clean);
    if (!ok) {
      setRowError({ id, message: copy.invalidCategory });
      announce(copy.invalidCategory, false);
      return;
    }
    setEditingId(null);
    setEditingName("");
    setRowError(null);
    announce(copy.categoryRenamed, true);
  };

  const removeCategory = (id: string) => {
    if (categoryUsage(id) > 0 || !deleteCategory(id)) {
      setRowError({ id, message: copy.categoryInUse });
      announce(copy.categoryInUse, false);
      return;
    }
    setRowError(null);
    announce(copy.categoryDeleted, true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Guarded at the UI edge as well: never hand unparsed input to the store.
    const parsed = parseCategoryInput({ name, type, walletId });
    if (!parsed) return setError(copy.invalidCategory);
    const ok = addCategory(parsed.walletId ? parsed : { name: parsed.name, type: parsed.type });
    if (!ok) return setError(copy.invalidCategory);
    setName("");
    setError(undefined);
  };

  return (
    <div
      className="fixed inset-0 z-[180] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={copy.categories}
        data-testid="category-sheet"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[26px] border-t border-outline-variant/20 bg-surface-container-high p-5 pb-[calc(env(safe-area-inset-bottom,0px)+120px)] shadow-2xl"
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-3 block h-1 w-10 rounded-full bg-outline-variant/60"
        />
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-title text-on-surface">{copy.categories}</h3>
          <button
            type="button"
            aria-label={copy.close}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-variant text-on-surface-variant"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div
          className="mt-4 grid grid-cols-2 gap-2 rounded-full bg-surface-container p-1"
          role="tablist"
          aria-label={copy.categories}
        >
          {(["income", "expense"] as TxType[]).map((tp) => (
            <button
              key={tp}
              type="button"
              role="tab"
              aria-selected={type === tp}
              onClick={() => setType(tp)}
              className={`rounded-full py-2 text-sm font-semibold transition-colors ${
                type === tp ? "bg-primary-container/40 text-primary" : "text-on-surface-variant"
              }`}
            >
              {tp === "income" ? copy.income : copy.expense}
            </button>
          ))}
        </div>

        <form className="mt-4 flex flex-col gap-3" onSubmit={submit} noValidate>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-on-surface-variant/80">{copy.categoryName}</span>
            <input
              value={name}
              minLength={2}
              maxLength={24}
              data-testid="category-name"
              aria-invalid={!!error}
              onChange={(e) => setName(e.target.value)}
              className="h-12 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-on-surface-variant/80">{copy.categoryScope}</span>
            <select
              value={walletId}
              data-testid="category-scope"
              onChange={(e) => setWalletId(e.target.value)}
              className="h-12 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <option value="">{copy.allAccounts}</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {`${w.name} · ${WALLET_TYPE_LABEL[w.type]}`}
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <p role="alert" className="m-0 text-[11px] font-semibold text-error">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            data-testid="category-submit"
            className="gradient-primary h-12 rounded-full text-[13px] font-bold text-on-primary-container transition-transform active:scale-95"
          >
            {copy.addCategory}
          </button>
        </form>

        <p aria-live="polite" className="sr-only">
          {status}
        </p>

        {filterNotice ? (
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="category-filter-reset-notice"
            className="mt-2 m-0 rounded-2xl bg-surface-container px-4 py-2 text-[11px] font-semibold text-on-surface-variant"
          >
            {filterNotice}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="sr-only">{copy.searchCategories}</span>
            <input
              type="search"
              value={query}
              maxLength={40}
              placeholder={copy.searchCategories}
              aria-label={copy.searchCategories}
              data-testid="category-search"
              onChange={(e) => {
                setFilterNotice("");
                setFilterTouched(true);
                setQuery(toCategoryQuery(e.target.value));
              }}
              className="h-11 w-full rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="sr-only">{copy.categoryScope}</span>
            <select
              value={typeFilter}
              aria-label={copy.allTypes}
              data-testid="category-filter-type"
              onChange={(e) => {
                setFilterNotice("");
                setFilterTouched(true);
                setTypeFilter(toCategoryTypeFilter(e.target.value));
              }}
              className="h-11 rounded-2xl border border-outline-variant/30 bg-surface-container px-3 text-[13px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <option value="all">{`${copy.allTypes} (${counts.all})`}</option>
              <option value="income">{`${copy.income} (${counts.income})`}</option>
              <option value="expense">{`${copy.expense} (${counts.expense})`}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="sr-only">{copy.sortLabel}</span>
            <select
              value={sort}
              aria-label={copy.sortLabel}
              data-testid="category-sort"
              onChange={(e) => setSort(toCategorySort(e.target.value))}
              className="h-11 rounded-2xl border border-outline-variant/30 bg-surface-container px-3 text-[13px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {CATEGORY_SORTS.map((option) => (
                <option key={option} value={option}>
                  {option === "name-asc"
                    ? copy.sortNameAsc
                    : option === "name-desc"
                      ? copy.sortNameDesc
                      : copy.sortMostUsed}
                </option>
              ))}
            </select>
          </label>
          {filtersDirty ? (
            <button
              type="button"
              data-testid="category-reset-filter"
              onClick={resetFilters}
              className="h-11 shrink-0 rounded-2xl border border-outline-variant/30 px-4 text-[12px] font-semibold text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {copy.resetFilter}
            </button>
          ) : null}
        </div>

        {categories.length && filtersReady && hiddenCount > 0 ? (
          // Only one "Reset filter" control exists: the button in the filter
          // toolbar above. This row is a pure status message (visible count vs
          // total) so the same action is never duplicated on screen.
          <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-surface-container px-4 py-2">
            <p
              role="status"
              aria-live="polite"
              data-testid="category-filter-summary"
              className="m-0 text-[11px] font-semibold text-on-surface-variant"
            >
              {`${list.length}/${categories.length}`}
            </p>
          </div>
        ) : null}

        <ul
          id="category-list"
          aria-label={copy.categories}
          className="mt-3 list-none rounded-2xl bg-surface-container px-4 py-1"
        >
          {visibleList.length ? (
            visibleList.map((c) => {
              const scope = c.walletId
                ? (wallets.find((w) => w.id === c.walletId)?.name ?? copy.allAccounts)
                : copy.allAccounts;
              const used = categoryUsage(c.id);
              const editing = editingId === c.id;
              const message = rowError && rowError.id === c.id ? rowError.message : null;
              return (
                <li
                  key={c.id}
                  data-testid={`category-item-${c.id}`}
                  className="flex flex-col gap-2 border-b border-outline-variant/20 py-3 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {editing ? (
                      <input
                        autoFocus
                        value={editingName}
                        maxLength={24}
                        aria-label={`${copy.renameCategory} ${c.name}`}
                        aria-invalid={!!message}
                        data-testid={`category-rename-input-${c.id}`}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitRename(c.id);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setEditingId(null);
                            setRowError(null);
                          }
                        }}
                        className="h-10 min-w-0 flex-1 rounded-2xl border border-outline-variant/30 bg-surface-container-high px-3 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      />
                    ) : (
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-on-surface">
                          {c.name}
                        </span>
                        <span className="truncate text-[11px] text-on-surface-variant/80">
                          {`${scope} · ${used}`}
                        </span>
                      </span>
                    )}

                    {editing ? (
                      <>
                        <button
                          type="button"
                          aria-label={copy.save}
                          data-testid={`category-rename-save-${c.id}`}
                          onClick={() => commitRename(c.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container/40 text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                          <Icon name="check" className="text-[18px]" />
                        </button>
                        <button
                          type="button"
                          aria-label={copy.cancel}
                          onClick={() => {
                            setEditingId(null);
                            setRowError(null);
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-variant text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                          <Icon name="close" className="text-[18px]" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label={`${copy.rename} ${c.name}`}
                          data-testid={`category-rename-${c.id}`}
                          onClick={() => startRename(c.id, c.name)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-variant text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                          <Icon name="edit" className="text-[18px]" />
                        </button>
                        <button
                          type="button"
                          aria-label={`${copy.delete} ${c.name}`}
                          data-testid={`category-delete-${c.id}`}
                          aria-disabled={used > 0}
                          onClick={() => removeCategory(c.id)}
                          className={`flex h-9 w-9 items-center justify-center rounded-full bg-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60 ${
                            used > 0 ? "text-on-surface-variant/40" : "text-error"
                          }`}
                        >
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                      </>
                    )}
                  </div>
                  {message ? (
                    <p
                      role="alert"
                      data-testid={`category-error-${c.id}`}
                      className="m-0 text-[11px] font-semibold text-error"
                    >
                      {message}
                    </p>
                  ) : null}
                </li>
              );
            })
          ) : (
            <li
              data-testid="category-empty"
              className="flex flex-col items-center gap-3 px-3 py-6 text-center text-[12px] text-on-surface-variant/70"
            >
              <span className="text-[13px] font-bold text-on-surface">
                {categories.length ? copy.noCategoryResults : copy.categoriesEmpty}
              </span>
              {categories.length ? (
                <button
                  type="button"
                  data-testid="category-empty-reset"
                  onClick={resetFilters}
                  className="rounded-full border border-outline-variant/30 px-4 py-2 text-[12px] font-semibold text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  {copy.resetFilter}
                </button>
              ) : null}
            </li>
          )}
        </ul>

        {collapsed && list.length > visibleList.length ? (
          <p
            role="status"
            aria-live="polite"
            data-testid="category-collapsed-notice"
            className="mt-2 m-0 rounded-2xl bg-primary-container/30 px-4 py-2 text-[11px] font-semibold text-primary"
          >
            {`${visibleList.length}/${list.length}`}
          </p>
        ) : null}

        {list.length > COLLAPSED_CATEGORY_ROWS && !filtersDirty ? (
          <button
            type="button"
            data-testid="category-toggle-all"
            aria-expanded={!collapsed}
            aria-controls="category-list"
            data-state={collapsed ? "collapsed" : "expanded"}
            onClick={() => setExpanded((v) => !v)}
            className={`mt-2 h-11 w-full rounded-2xl border text-[12px] font-semibold focus-visible:ring-2 focus-visible:ring-primary/60 ${
              collapsed
                ? "border-primary/60 bg-primary-container/30 text-primary"
                : "border-outline-variant/30 text-on-surface-variant"
            }`}
          >
            {collapsed ? `${copy.showAllCategories} (${list.length})` : copy.collapseCategories}
          </button>
        ) : null}
      </div>
    </div>
  );
}
