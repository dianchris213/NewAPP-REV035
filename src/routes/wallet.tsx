import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AppShell, TopBar } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { ListSkeleton, Skeleton } from "@/components/Skeleton";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import {
  formatIDR,
  useApp,
  WALLET_PROVIDERS,
  WALLET_TYPE_LABEL,
  type Wallet as WalletAccount,
  type WalletActivity,
  type WalletActivityKind,
  type WalletType,
} from "@/lib/app-store";
import { t } from "@/lib/i18n";
import { isOneOf, isString, usePersistentState } from "@/lib/persistent-filter";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Dompet - Catatan Keuangan Mini App" },
      {
        name: "description",
        content: "Kelola akun dompet, isi saldo, transfer, dan lihat aktivitas dompet Anda.",
      },
      { property: "og:title", content: "Dompet - Catatan Keuangan Mini App" },
      {
        property: "og:description",
        content: "Kelola akun dompet dan aktivitas saldo Anda.",
      },
    ],
  }),
  component: Wallet,
});

const WALLET_TYPES: { value: WalletType; icon: string; hint: string }[] = [
  { value: "cash", icon: "payments", hint: "Uang fisik di dompet atau kas" },
  { value: "bank", icon: "account_balance", hint: "Rekening bank utama Anda" },
  { value: "ewallet", icon: "wallet", hint: "Saldo aplikasi pembayaran digital" },
];

const ACTIVITY_FILTERS: { value: "all" | WalletActivityKind; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "topup", label: "Isi Saldo" },
  { value: "transfer", label: "Transfer" },
  { value: "create", label: "Dibuat" },
  { value: "rename", label: "Diubah" },
  { value: "delete", label: "Dihapus" },
  { value: "profile", label: "Profil" },
];

const ACTIVITY_META: Record<WalletActivityKind, { icon: string; tone: string }> = {
  topup: { icon: "account_balance_wallet", tone: "bg-success/15 text-success" },
  transfer: { icon: "swap_horiz", tone: "bg-primary-container/25 text-primary" },
  create: { icon: "add_circle", tone: "bg-surface-variant text-on-surface-variant" },
  rename: { icon: "edit", tone: "bg-primary-container/25 text-primary" },
  delete: { icon: "delete", tone: "bg-error/15 text-error" },
  profile: { icon: "person", tone: "bg-surface-variant text-on-surface-variant" },
};

const WALLET_ICON: Record<WalletType, string> = {
  cash: "payments",
  bank: "account_balance",
  ewallet: "wallet",
};

const AMOUNT_MAX = 1_000_000_000_000;

/** Persisted "Tambah Kantong" filters. */
const AW_QUERY_KEY = "tmab-add-wallet-query";
const AW_TYPE_KEY = "tmab-add-wallet-type";
const isWalletType = isOneOf(["cash", "bank", "ewallet"] as const);
const isWalletTypeOrNull = (v: unknown): v is WalletType | null => v === null || isWalletType(v);

type ProviderGroup = { provider: string; items: WalletAccount[] };

/** Groups a wallet type's accounts by their provider sub-type, ordered by catalog. */
function providerBreakdown(type: WalletType, items: WalletAccount[]): ProviderGroup[] {
  const order = WALLET_PROVIDERS[type];
  const map = new Map<string, WalletAccount[]>();
  for (const item of items) {
    const key = item.provider?.trim() || WALLET_TYPE_LABEL[type];
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return [...map.entries()]
    .map(([provider, list]) => ({ provider, items: list }))
    .sort((a, b) => {
      const ia = order.indexOf(a.provider);
      const ib = order.indexOf(b.provider);
      if (ia === ib) return a.provider.localeCompare(b.provider);
      if (ia < 0) return 1;
      if (ib < 0) return -1;
      return ia - ib;
    });
}

function Wallet() {
  const {
    wallets,
    walletActivity,
    addWallet,
    topUpWallet,
    transferBetweenWallets,
    transactions,
    settings,
    locked,
    unlockApp,
    language,
    hydrated,
  } = useApp();

  const [addOpen, setAddOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState<null | "topup" | "transfer">(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<"all" | WalletActivityKind>("all");
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<WalletType[]>(["cash"]);
  const toggleType = useCallback((type: WalletType) => {
    setExpandedTypes((prev) =>
      prev.includes(type) ? prev.filter((t2) => t2 !== type) : [...prev, type],
    );
  }, []);
  const copy = t(language);

  const combined = useMemo(() => wallets.reduce((sum, w) => sum + w.balance, 0), [wallets]);

  const grouped = useMemo(
    () =>
      (["cash", "bank", "ewallet"] as WalletType[]).map((type) => ({
        type,
        items: wallets.filter((w) => w.type === type),
      })),
    [wallets],
  );

  const historyWallet = useMemo(
    () => wallets.find((w) => w.id === historyId) ?? null,
    [wallets, historyId],
  );

  const visibleActivity = useMemo(
    () =>
      activityFilter === "all"
        ? walletActivity
        : walletActivity.filter((a) => a.kind === activityFilter),
    [walletActivity, activityFilter],
  );

  const openAdd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAddOpen(true);
  }, []);

  // App Lock gate: the Wallet page is challenged before any balance is shown.
  if (settings.biometricLock && locked) {
    return (
      <AppShell topBar={<TopBar eyebrow="Keamanan" title={copy.lockedTitle} />}>
        <div className="glass-card flex flex-col items-center gap-4 rounded-[24px] p-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container/30 text-primary">
            <Icon name="fingerprint" className="text-[32px]" fill={1} />
          </span>
          <h2 className="m-0 text-title text-on-surface">{copy.lockedTitle}</h2>
          <p className="m-0 text-body text-on-surface-variant">{copy.lockedBody}</p>
          <button
            type="button"
            data-testid="wallet-unlock"
            autoFocus
            onClick={() => unlockApp()}
            className="gradient-primary h-12 w-full max-w-xs rounded-full text-[13px] font-bold text-on-primary-container transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            {copy.unlock}
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell topBar={<TopBar eyebrow="Keuangan Anda" title="Dompet" />}>
      <div className="gradient-hero relative overflow-hidden rounded-[24px] p-[20px]">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary-container/20 blur-2xl" />
        <span className="text-label uppercase text-primary/80">Saldo Gabungan</span>
        {hydrated ? (
          <p
            data-testid="wallet-combined"
            className="mt-1 break-words text-display tabular-nums tracking-tight text-on-surface"
          >
            {formatIDR(combined)}
          </p>
        ) : (
          <Skeleton className="mt-2 h-8 w-48 rounded-xl" />
        )}
        <p className="text-body text-on-surface-variant">{`Dari ${wallets.length} akun aktif`}</p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            data-testid="wallet-topup-trigger"
            aria-haspopup="dialog"
            disabled={!wallets.length}
            onClick={(e) => {
              e.stopPropagation();
              setMoveOpen("topup");
            }}
            className="gradient-primary flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-bold text-on-primary-container transition-transform active:scale-95 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Icon name="add_card" className="text-[18px]" /> Isi Saldo
          </button>
          <button
            type="button"
            data-testid="wallet-transfer-trigger"
            aria-haspopup="dialog"
            disabled={wallets.length < 2}
            onClick={(e) => {
              e.stopPropagation();
              setMoveOpen("transfer");
            }}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container text-[13px] font-semibold text-on-surface transition-transform active:scale-95 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Icon name="swap_horiz" className="text-[18px]" /> Transfer
          </button>
        </div>
      </div>

      <section className="mt-stack-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-section text-on-surface">Akun Anda</h2>
          <button
            type="button"
            data-testid="wallet-add-trigger"
            aria-haspopup="dialog"
            onClick={openAdd}
            className="flex h-9 items-center gap-1 rounded-full border border-outline-variant/30 px-3 text-[12px] font-semibold text-on-surface-variant transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Icon name="add" className="text-[16px]" />
            Tambah Kantong
          </button>
        </div>
        {!hydrated ? (
          <div className="glass-card rounded-[16px] px-4">
            <ListSkeleton rows={3} label="Memuat kantong" testId="wallet-skeleton" />
          </div>
        ) : !wallets.length ? (
          <div className="flex flex-col items-center gap-3" data-testid="wallet-empty">
            <EmptyState
              icon="account_balance_wallet"
              title="Belum ada kantong"
              description="Buat kantong pertama Anda untuk mulai mencatat saldo dan transaksi."
            />
            <button
              type="button"
              data-testid="wallet-empty-cta"
              aria-haspopup="dialog"
              onClick={openAdd}
              className="gradient-primary h-11 w-full max-w-xs rounded-full text-[13px] font-bold text-on-primary-container transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              Tambah Kantong Pertama
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {grouped.map((group) => {
              const open = expandedTypes.includes(group.type);
              const groupTotal = group.items.reduce((sum, w) => sum + w.balance, 0);
              const providerGroups = providerBreakdown(group.type, group.items);
              return (
                <div key={group.type} className="glass-card rounded-[16px] px-4">
                  <button
                    type="button"
                    data-testid={`wallet-group-${group.type}`}
                    aria-expanded={open}
                    aria-controls={`wallet-group-panel-${group.type}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleType(group.type);
                    }}
                    className="flex w-full items-center gap-3 py-3 text-left focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-variant text-primary">
                      <Icon name={WALLET_ICON[group.type]} className="text-[20px]" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body font-semibold text-on-surface">
                        {WALLET_TYPE_LABEL[group.type]}
                      </span>
                      <span className="truncate text-meta text-on-surface-variant/80">
                        {`${group.items.length} akun · ${providerGroups.length} jenis`}
                      </span>
                    </span>
                    <span className="shrink-0 text-body font-semibold tabular-nums text-on-surface">
                      {formatIDR(groupTotal)}
                    </span>
                    <Icon
                      name="expand_more"
                      className={`text-[18px] text-on-surface-variant transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <div
                    id={`wallet-group-panel-${group.type}`}
                    aria-hidden={!open}
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                      open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-outline-variant/20 pb-2">
                        {providerGroups.length ? (
                          providerGroups.map((pg) => (
                            <div key={pg.provider} className="pt-2">
                              <h4 className="mb-1 text-label uppercase text-primary/80">
                                {pg.provider}
                              </h4>
                              {pg.items.map((w) => (
                                <button
                                  key={w.id}
                                  type="button"
                                  data-testid={`wallet-account-${w.id}`}
                                  aria-haspopup="dialog"
                                  tabIndex={open ? 0 : -1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHistoryId(w.id);
                                  }}
                                  className="flex w-full items-center gap-3 border-b border-outline-variant/20 py-2.5 pl-2 text-left last:border-0 focus-visible:ring-2 focus-visible:ring-primary/60"
                                >
                                  <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-body font-medium text-on-surface">
                                      {w.name}
                                    </span>
                                    <span className="truncate text-meta text-on-surface-variant/80">
                                      {w.provider ?? WALLET_TYPE_LABEL[w.type]}
                                    </span>
                                  </span>
                                  <span className="shrink-0 text-body font-semibold tabular-nums text-on-surface">
                                    {formatIDR(w.balance)}
                                  </span>
                                  <Icon
                                    name="chevron_right"
                                    className="text-[18px] text-on-surface-variant"
                                  />
                                </button>
                              ))}
                            </div>
                          ))
                        ) : (
                          <p className="py-3 text-meta text-on-surface-variant/70">
                            Belum ada kantong pada jenis ini.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-stack-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-section text-on-surface">Aktivitas Dompet</h2>
          <button
            type="button"
            data-testid="wallet-activity-filter"
            aria-expanded={filterOpen}
            aria-controls="wallet-activity-filters"
            aria-label="Filter jenis aktivitas"
            onClick={(e) => {
              e.stopPropagation();
              setFilterOpen((v) => !v);
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-primary/60 ${
              activityFilter === "all"
                ? "bg-surface-variant text-on-surface-variant"
                : "bg-primary-container/30 text-primary"
            }`}
          >
            <Icon name="filter_list" className="text-[18px]" />
          </button>
        </div>

        <div
          id="wallet-activity-filters"
          aria-hidden={!filterOpen}
          className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
            filterOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="swipe-x mb-3 flex gap-2" role="group" aria-label="Filter aktivitas">
              {ACTIVITY_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={activityFilter === f.value}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivityFilter(f.value);
                  }}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                    activityFilter === f.value
                      ? "border-primary bg-primary-container/25 text-primary"
                      : "border-outline-variant/30 text-on-surface-variant"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visibleActivity.length ? (
          <ul className="glass-card rounded-[16px] px-4">
            {visibleActivity.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </ul>
        ) : (
          <EmptyState icon="history" title="Belum ada aktivitas" />
        )}
      </section>

      {moveOpen ? (
        <MoveMoneySheet
          mode={moveOpen}
          wallets={wallets}
          onClose={() => setMoveOpen(null)}
          onTopUp={(payload) => {
            const ok = topUpWallet(payload);
            if (!ok) return "Isi saldo gagal. Periksa kembali data.";
            setMoveOpen(null);
            toast.success("Saldo ditambahkan", { description: formatIDR(payload.amount) });
            return null;
          }}
          onTransfer={(payload) => {
            const ok = transferBetweenWallets(payload);
            if (!ok) return "Transfer gagal. Saldo tidak cukup atau kantong tidak valid.";
            setMoveOpen(null);
            toast.success("Transfer berhasil", { description: formatIDR(payload.amount) });
            return null;
          }}
        />
      ) : null}

      {addOpen ? (
        <AddWalletSheet
          onClose={() => setAddOpen(false)}
          onSubmit={(payload) => {
            void addWallet(payload).then((result) => {
              if (!result.ok) {
                toast.error(
                  result.reason === "api"
                    ? "Gagal menyimpan kantong. Periksa koneksi lalu coba lagi."
                    : "Nama kantong tidak valid atau duplikat.",
                );
                return;
              }
              toast.success("Kantong ditambahkan", {
                description: `${payload.name} · ${formatIDR(payload.balance)}`,
              });
            });
            setAddOpen(false);
          }}
        />
      ) : null}

      {historyWallet ? (
        <AccountHistorySheet
          wallet={historyWallet}
          rows={transactions.filter((tx) => tx.walletId === historyWallet.id)}
          emptyLabel={copy.accountHistoryEmpty}
          title={copy.accountHistory}
          onClose={() => setHistoryId(null)}
        />
      ) : null}
    </AppShell>
  );
}

/** Per-account history: every transaction that moves this account's balance. */
function AccountHistorySheet({
  wallet,
  rows,
  title,
  emptyLabel,
  onClose,
}: {
  wallet: WalletAccount;
  rows: {
    id: string;
    type: "income" | "expense";
    amount: number;
    category: string;
    note: string;
    date: string;
  }[];
  title: string;
  emptyLabel: string;
  onClose: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(true, onClose);
  const { language } = useApp();
  const copy = t(language);
  const [keyword, setKeyword] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const sorted = useMemo(
    () => [...rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTime = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
    return sorted.filter((tx) => {
      if (q && !`${tx.category} ${tx.note}`.toLowerCase().includes(q)) return false;
      const time = new Date(tx.date).getTime();
      if (fromTime !== null && Number.isFinite(fromTime) && time < fromTime) return false;
      if (toTime !== null && Number.isFinite(toTime) && time > toTime) return false;
      return true;
    });
  }, [sorted, keyword, from, to]);

  const dirty = !!(keyword || from || to);
  const rangeInvalid = !!(from && to && from > to);

  return (
    <SheetPortal>
      <div
        className="fixed inset-0 z-[180] flex items-end justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={`${title} ${wallet.name}`}
          data-testid="wallet-history-sheet"
          onClick={(e) => e.stopPropagation()}
          className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[26px] border-t border-outline-variant/20 bg-surface-container-high p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] shadow-2xl"
        >
          <span
            aria-hidden="true"
            className="mx-auto mb-3 block h-1 w-10 rounded-full bg-outline-variant/60"
          />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="m-0 truncate text-title text-on-surface">{wallet.name}</h3>
              <p className="mt-0.5 text-meta text-on-surface-variant/80">
                {`${title} · ${wallet.provider ?? WALLET_TYPE_LABEL[wallet.type]}`}
              </p>
            </div>
            <span className="shrink-0 text-body font-bold text-on-surface">
              {formatIDR(wallet.balance)}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="sr-only">{copy.searchPlaceholder}</span>
              <input
                type="search"
                value={keyword}
                maxLength={40}
                placeholder={copy.searchPlaceholder}
                data-testid="history-search"
                onChange={(e) => setKeyword(e.target.value)}
                className="h-11 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-meta text-on-surface-variant/80">{copy.dateFrom}</span>
                <input
                  type="date"
                  value={from}
                  max={to || undefined}
                  aria-invalid={rangeInvalid}
                  data-testid="history-date-from"
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-11 rounded-2xl border border-outline-variant/30 bg-surface-container px-3 text-[13px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-meta text-on-surface-variant/80">{copy.dateTo}</span>
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  aria-invalid={rangeInvalid}
                  data-testid="history-date-to"
                  onChange={(e) => setTo(e.target.value)}
                  className="h-11 rounded-2xl border border-outline-variant/30 bg-surface-container px-3 text-[13px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                />
              </label>
            </div>
            {dirty ? (
              <button
                type="button"
                data-testid="history-reset"
                onClick={() => {
                  setKeyword("");
                  setFrom("");
                  setTo("");
                }}
                className="self-start rounded-full border border-outline-variant/30 px-3 py-1.5 text-[12px] font-semibold text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {copy.resetFilters}
              </button>
            ) : null}
            <p aria-live="polite" className="m-0 text-[11px] text-on-surface-variant/70">
              {`${filtered.length}/${sorted.length}`}
            </p>
          </div>

          {filtered.length ? (
            <ul className="mt-2 list-none rounded-2xl bg-surface-container px-4 py-1">
              {filtered.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center gap-3 border-b border-outline-variant/20 py-3 last:border-0"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      tx.type === "income" ? "bg-success/15 text-success" : "bg-error/15 text-error"
                    }`}
                  >
                    <Icon
                      name={tx.type === "income" ? "south_west" : "north_east"}
                      className="text-[18px]"
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body font-medium text-on-surface">
                      {tx.category}
                    </span>
                    <span className="truncate text-meta text-on-surface-variant/80">
                      {tx.note || "-"}
                    </span>
                    <span className="text-meta text-on-surface-variant/60">
                      {new Date(tx.date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-body font-semibold ${
                      tx.type === "income" ? "text-success" : "text-error"
                    }`}
                  >
                    {`${tx.type === "income" ? "+" : "-"}${formatIDR(tx.amount)}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-center text-[12px] text-on-surface-variant/70">
              {sorted.length ? copy.noResults : emptyLabel}
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-5 h-12 w-full rounded-full bg-surface-variant text-[13px] font-semibold text-on-surface-variant transition-transform active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </SheetPortal>
  );
}

/** Renders sheet markup on <body> so it escapes the shell's stacking context. */
function SheetPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

function ActivityRow({ activity }: { activity: WalletActivity }) {
  const meta = ACTIVITY_META[activity.kind];
  return (
    <li className="flex items-center gap-3 border-b border-outline-variant/20 py-3 last:border-0">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.tone}`}
      >
        <Icon name={meta.icon} className="text-[18px]" fill={1} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-medium text-on-surface">{activity.title}</span>
        <span className="truncate text-meta text-on-surface-variant/80">{activity.detail}</span>
        <span className="truncate text-meta text-on-surface-variant/60">
          {new Date(activity.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
        </span>
      </div>
      {activity.amount > 0 ? (
        <span className="shrink-0 text-body font-semibold tabular-nums text-on-surface">
          {formatIDR(activity.amount)}
        </span>
      ) : null}
    </li>
  );
}

/** Bottom sheet to create a wallet: type selection + provider sub-menu. */
function AddWalletSheet({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    type: WalletType;
    provider?: string;
    balance: number;
  }) => void;
}) {
  // Non-dismissible: focus trap only. Closing happens via Batal / Simpan.
  const ref = useModalA11y<HTMLDivElement>(true, () => {});
  const { wallets } = useApp();
  // Search + jenis filter survive sheet reopen and page reload.
  const [type, setType, resetType] = usePersistentState<WalletType | null>(
    AW_TYPE_KEY,
    null,
    isWalletTypeOrNull,
  );
  const [query, setQuery, resetQuery] = usePersistentState<string>(AW_QUERY_KEY, "", isString);
  const [provider, setProvider] = useState("");
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  type FieldKey = "type" | "provider" | "name" | "balance";
  const [fieldError, setFieldError] = useState<Partial<Record<FieldKey, string>>>({});
  const clearFieldError = (key: FieldKey) =>
    setFieldError((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const trimmedName = name.trim();
  const numericBalance = Number(balance.replace(/\D/g, "")) || 0;
  // Sumber dana options come from what the user registered in Pengaturan → Sumber Dana.
  const allProviders = useMemo(
    () =>
      type
        ? Array.from(
            new Set(
              wallets
                .filter((w) => w.type === type)
                .map((w) => (w.provider?.trim() ? w.provider.trim() : w.name.trim()))
                .filter(Boolean),
            ),
          )
        : [],
    [wallets, type],
  );

  const providerOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? allProviders.filter((p) => p.toLowerCase().includes(q)) : allProviders;
  }, [allProviders, query]);

  const filtersDirty = !!query.trim() || type !== null;
  const resetFilters = () => {
    resetQuery();
    resetType();
    setProvider("");
    setError(undefined);
    setFieldError({});
  };

  // Pocket names must be unique inside their Sumber Dana (same type + provider).
  const duplicateName = useMemo(() => {
    if (!type || !provider || trimmedName.length < 2) return false;
    return wallets.some(
      (w) =>
        w.type === type &&
        (w.provider?.trim() || WALLET_TYPE_LABEL[w.type]) === provider &&
        w.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );
  }, [wallets, type, provider, trimmedName]);

  const duplicateMessage = `Nama "${trimmedName}" sudah dipakai pada Sumber Dana ${provider}.`;

  const canSubmit =
    !!type &&
    allProviders.length > 0 &&
    !!provider &&
    !duplicateName &&
    trimmedName.length >= 2 &&
    trimmedName.length <= 30 &&
    numericBalance > 0 &&
    numericBalance <= AMOUNT_MAX;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<FieldKey, string>> = {};
    if (!type) next.type = "Pilih Jenis kantong terlebih dahulu.";
    else if (!allProviders.length)
      next.provider =
        "Belum ada Sumber Dana untuk jenis ini. Tambahkan dulu di Pengaturan → Sumber Dana.";
    else if (!provider || !allProviders.includes(provider))
      next.provider = "Pilih Nama Sumber Dana yang tersedia.";
    if (trimmedName.length < 2) next.name = "Nama kantong minimal 2 karakter.";
    else if (trimmedName.length > 30) next.name = "Nama kantong maksimal 30 karakter.";
    else if (duplicateName) next.name = duplicateMessage;
    if (numericBalance <= 0) next.balance = "Masukkan nominal saldo yang valid.";
    else if (numericBalance > AMOUNT_MAX) next.balance = "Saldo awal terlalu besar.";

    setFieldError(next);
    const first = next.type ?? next.provider ?? next.name ?? next.balance;
    if (first || !type) {
      setError(first ?? "Pilih Jenis kantong terlebih dahulu.");
      return;
    }
    setError(undefined);
    onSubmit({
      name: trimmedName,
      type,
      ...(provider ? { provider } : {}),
      balance: numericBalance,
    });
  };

  return (
    <SheetPortal>
      <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/60 backdrop-blur-sm">
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label="Tambah kantong"
          data-testid="wallet-add-sheet"
          onClick={(e) => e.stopPropagation()}
          className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[26px] border-t border-outline-variant/20 bg-surface-container-high p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] shadow-2xl"
        >
          <span
            aria-hidden="true"
            className="mx-auto mb-3 block h-1 w-10 rounded-full bg-outline-variant/60"
          />
          <h3 className="m-0 text-title text-on-surface">Tambah Kantong</h3>
          <p className="mt-1 text-[12px] text-on-surface-variant/80">
            Pilih jenis kantong, lalu lengkapi detailnya.
          </p>

          <form className="mt-4 flex flex-col gap-4" onSubmit={submit} noValidate>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Jenis kantong">
              {WALLET_TYPES.map((t) => {
                const active = type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`wallet-type-${t.value}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setType(t.value);
                      setProvider("");
                      setError(undefined);
                      setFieldError({});
                    }}
                    className={`flex h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 text-center transition-colors ${
                      active
                        ? "border-primary bg-primary-container/25 text-primary"
                        : "border-outline-variant/30 text-on-surface-variant"
                    }`}
                  >
                    <Icon name={t.icon} className="text-[22px]" fill={active ? 1 : 0} />
                    <span className="text-[12px] font-semibold leading-tight">
                      {WALLET_TYPE_LABEL[t.value]}
                    </span>
                  </button>
                );
              })}
            </div>

            {type ? (
              <p className="m-0 text-[11px] text-on-surface-variant/70">
                {WALLET_TYPES.find((t) => t.value === type)?.hint}
              </p>
            ) : null}
            {fieldError.type ? (
              <p
                role="alert"
                data-testid="wallet-error-type"
                className="m-0 text-[11px] font-semibold text-error"
              >
                {fieldError.type}
              </p>
            ) : null}

            {/* Sub-menu: user-registered sumber dana (empty until created in Pengaturan). */}
            {type ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-meta text-on-surface-variant/80" id="wallet-provider-label">
                    Nama Sumber Dana
                  </span>
                  <span
                    aria-live="polite"
                    className="text-[11px] tabular-nums text-on-surface-variant/70"
                  >
                    {`${providerOptions.length}/${allProviders.length}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="search"
                    value={query}
                    maxLength={30}
                    placeholder="Cari sumber dana"
                    aria-label="Cari sumber dana"
                    data-testid="wallet-provider-search"
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-11 min-w-0 flex-1 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[13px] text-on-surface outline-none placeholder:text-on-surface-variant/50 focus-visible:ring-2 focus-visible:ring-primary/60"
                  />
                  {filtersDirty ? (
                    <button
                      type="button"
                      data-testid="wallet-filter-reset"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetFilters();
                      }}
                      className="h-11 shrink-0 rounded-full border border-outline-variant/30 px-4 text-[12px] font-semibold text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      Reset filter
                    </button>
                  ) : null}
                </div>
                {providerOptions.length ? (
                  <div
                    role="radiogroup"
                    aria-labelledby="wallet-provider-label"
                    data-testid="wallet-provider-grid"
                    className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                  >
                    {providerOptions.map((p) => {
                      const active = provider === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          data-testid={`wallet-provider-${p}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setProvider(p);
                            setError(undefined);
                            clearFieldError("provider");
                            setName((prev) => (prev.trim() ? prev : p));
                          }}
                          className={`flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 text-center transition-colors focus-visible:ring-2 focus-visible:ring-primary/60 ${
                            active
                              ? "border-primary bg-primary-container/25 text-primary"
                              : "border-outline-variant/30 text-on-surface-variant"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
                              active
                                ? "bg-primary-container/40 text-primary"
                                : "bg-surface-variant text-on-surface-variant"
                            }`}
                          >
                            {p.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="w-full truncate text-[11px] font-semibold leading-tight">
                            {p}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : allProviders.length ? (
                  <p
                    data-testid="wallet-provider-no-results"
                    className="m-0 rounded-2xl border border-dashed border-outline-variant/40 px-4 py-4 text-center text-[11px] text-on-surface-variant/70"
                  >
                    {`Tidak ada Sumber Dana cocok dengan "${query.trim()}".`}
                  </p>
                ) : (
                  <p
                    data-testid="wallet-provider-empty"
                    className="m-0 rounded-2xl border border-dashed border-outline-variant/40 px-4 py-4 text-center text-[11px] text-on-surface-variant/70"
                  >
                    Belum ada Sumber Dana untuk jenis ini. Tambahkan dulu di Pengaturan → Sumber
                    Dana.
                  </p>
                )}

                {fieldError.provider ? (
                  <p
                    role="alert"
                    data-testid="wallet-error-provider"
                    className="m-0 text-[11px] font-semibold text-error"
                  >
                    {fieldError.provider}
                  </p>
                ) : null}
              </div>
            ) : null}

            <label className="flex flex-col gap-1">
              <span className="text-meta text-on-surface-variant/80">Nama Kantong</span>
              <input
                data-testid="wallet-name"
                value={name}
                maxLength={30}
                placeholder="Contoh: Tabungan Liburan"
                aria-invalid={!!fieldError.name || duplicateName}
                aria-errormessage={
                  fieldError.name || duplicateName ? "wallet-error-name" : undefined
                }
                onChange={(e) => {
                  setName(e.target.value);
                  clearFieldError("name");
                }}
                className="h-12 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[14px] text-on-surface outline-none placeholder:text-on-surface-variant/50 focus-visible:ring-2 focus-visible:ring-primary/60"
              />
              {fieldError.name || duplicateName ? (
                <span
                  id="wallet-error-name"
                  role="alert"
                  data-testid="wallet-error-name"
                  className="text-[11px] font-semibold text-error"
                >
                  {fieldError.name ?? duplicateMessage}
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-meta text-on-surface-variant/80">Saldo Awal</span>
              <input
                inputMode="numeric"
                data-testid="wallet-balance"
                value={(Number(balance.replace(/\D/g, "")) || 0).toLocaleString("id-ID")}
                aria-invalid={!!fieldError.balance}
                aria-errormessage={fieldError.balance ? "wallet-error-balance" : undefined}
                onChange={(e) => {
                  setBalance(e.target.value.replace(/\D/g, "").slice(0, 15));
                  clearFieldError("balance");
                }}
                className="h-12 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              />
              {fieldError.balance ? (
                <span
                  id="wallet-error-balance"
                  role="alert"
                  data-testid="wallet-error-balance"
                  className="text-[11px] font-semibold text-error"
                >
                  {fieldError.balance}
                </span>
              ) : null}
            </label>

            {error ? (
              <p
                data-testid="wallet-error-summary"
                className="m-0 text-[11px] font-semibold text-error"
              >
                {error}
              </p>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="h-12 flex-1 rounded-full bg-surface-variant text-[13px] font-semibold text-on-surface-variant transition-transform active:scale-95"
              >
                Batal
              </button>
              <button
                type="submit"
                data-testid="wallet-submit"
                aria-disabled={!canSubmit}
                className={`gradient-primary h-12 flex-1 rounded-full text-[13px] font-bold text-on-primary-container transition-transform active:scale-95 ${
                  canSubmit ? "" : "opacity-40"
                }`}
              >
                Simpan Kantong
              </button>
            </div>
          </form>
        </div>
      </div>
    </SheetPortal>
  );
}

/** Bottom sheet for topping up a wallet or transferring between wallets. */
function MoveMoneySheet({
  mode,
  wallets,
  onClose,
  onTopUp,
  onTransfer,
}: {
  mode: "topup" | "transfer";
  wallets: WalletAccount[];
  onClose: () => void;
  onTopUp: (payload: { walletId: string; amount: number; source?: string }) => string | null;
  onTransfer: (payload: { fromId: string; toId: string; amount: number }) => string | null;
}) {
  const ref = useModalA11y<HTMLDivElement>(true, onClose);
  const [fromId, setFromId] = useState(wallets[0]?.id ?? "");
  const [toId, setToId] = useState(wallets[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  const numeric = Number(amount.replace(/\D/g, "")) || 0;
  const isTopUp = mode === "topup";
  const title = isTopUp ? "Isi Saldo" : "Transfer Antar Kantong";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numeric <= 0) return setError("Nominal harus lebih besar dari 0.");
    if (numeric > AMOUNT_MAX) return setError("Nominal terlalu besar.");
    if (isTopUp) {
      if (!toId) return setError("Pilih kantong tujuan.");
      return setError(onTopUp({ walletId: toId, amount: numeric, source }) ?? undefined);
    }
    if (!fromId || !toId) return setError("Pilih kantong asal dan tujuan.");
    if (fromId === toId) return setError("Kantong asal dan tujuan harus berbeda.");
    const from = wallets.find((w) => w.id === fromId);
    if (from && from.balance < numeric) return setError("Saldo kantong asal tidak mencukupi.");
    return setError(onTransfer({ fromId, toId, amount: numeric }) ?? undefined);
  };

  return (
    <SheetPortal>
      <div
        className="fixed inset-0 z-[180] flex items-end justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          data-testid={`wallet-${mode}-sheet`}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[26px] border-t border-outline-variant/20 bg-surface-container-high p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] shadow-2xl"
        >
          <span
            aria-hidden="true"
            className="mx-auto mb-3 block h-1 w-10 rounded-full bg-outline-variant/60"
          />
          <h3 className="m-0 text-title text-on-surface">{title}</h3>

          <form className="mt-4 flex flex-col gap-4" onSubmit={submit} noValidate>
            {!isTopUp ? (
              <label className="flex flex-col gap-1">
                <span className="text-meta text-on-surface-variant/80">Dari Kantong</span>
                <select
                  data-testid="wallet-from"
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                  className="h-12 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {`${w.name} · ${formatIDR(w.balance)}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="flex flex-col gap-1">
              <span className="text-meta text-on-surface-variant/80">
                {isTopUp ? "Kantong Tujuan" : "Ke Kantong"}
              </span>
              <select
                data-testid="wallet-to"
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="h-12 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <option value="">Pilih...</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {`${w.name} · ${formatIDR(w.balance)}`}
                  </option>
                ))}
              </select>
            </label>

            {isTopUp ? (
              <label className="flex flex-col gap-1">
                <span className="text-meta text-on-surface-variant/80">Sumber Dana (opsional)</span>
                <input
                  data-testid="wallet-source"
                  value={source}
                  maxLength={30}
                  placeholder="Contoh: Transfer Bank"
                  onChange={(e) => setSource(e.target.value)}
                  className="h-12 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[14px] text-on-surface outline-none placeholder:text-on-surface-variant/50 focus-visible:ring-2 focus-visible:ring-primary/60"
                />
              </label>
            ) : null}

            <label className="flex flex-col gap-1">
              <span className="text-meta text-on-surface-variant/80">Nominal</span>
              <input
                inputMode="numeric"
                data-testid="wallet-amount"
                aria-invalid={!!error}
                value={numeric ? numeric.toLocaleString("id-ID") : ""}
                placeholder="0"
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 15))}
                className="h-12 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[14px] text-on-surface outline-none placeholder:text-on-surface-variant/50 focus-visible:ring-2 focus-visible:ring-primary/60"
              />
            </label>

            {error ? (
              <p role="alert" className="m-0 text-[11px] font-semibold text-error">
                {error}
              </p>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="h-12 flex-1 rounded-full bg-surface-variant text-[13px] font-semibold text-on-surface-variant transition-transform active:scale-95"
              >
                Batal
              </button>
              <button
                type="submit"
                data-testid={`wallet-${mode}-submit`}
                className="gradient-primary h-12 flex-1 rounded-full text-[13px] font-bold text-on-primary-container transition-transform active:scale-95"
              >
                {isTopUp ? "Isi Saldo" : "Kirim"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </SheetPortal>
  );
}
