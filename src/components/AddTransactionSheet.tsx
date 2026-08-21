import { useCallback, useMemo, useState } from "react";
import {
  formatIDR,
  useApp,
  WALLET_TYPE_LABEL,
  type TxType,
  type WalletType,
} from "@/lib/app-store";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import { Icon } from "./Icon";

/** Only these three wallet families can fund/receive a transaction. */
const ALLOWED_WALLET_TYPES: { value: WalletType; icon: string }[] = [
  { value: "cash", icon: "payments" },
  { value: "bank", icon: "account_balance" },
  { value: "ewallet", icon: "wallet" },
];

const NOTE_MAX = 80;
const AMOUNT_MAX = 1_000_000_000_000;

const todayInput = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

type Errors = {
  amount?: string;
  wallet?: string;
  category?: string;
  date?: string;
};

export function AddTransactionSheet() {
  const { addTxOpen, setAddTxOpen, addTransaction, wallets, categoriesFor } = useApp();
  const [type, setType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [walletId, setWalletId] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(todayInput);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);

  const close = useCallback(() => setAddTxOpen(false), [setAddTxOpen]);
  // Non-dismissible: keep the focus trap, but never close from Esc/backdrop.
  const noDismiss = useCallback(() => {}, []);
  const containerRef = useModalA11y<HTMLFormElement>(addTxOpen, noDismiss);

  const numeric = Number(amount.replace(/\D/g, "")) || 0;
  const trimmedNote = note.trim();

  const subWallets = useMemo(
    () => (walletType ? wallets.filter((w) => w.type === walletType) : []),
    [wallets, walletType],
  );
  const availableCategories = useMemo(
    () => categoriesFor(type, walletId || undefined),
    [categoriesFor, type, walletId],
  );

  // Strict progressive disclosure: 1 Amount, 2 Wallet, 3 Category, 4 Date, 5 Note.
  const step1Done = numeric > 0 && numeric <= AMOUNT_MAX;
  const step2Done = step1Done && !!walletId && wallets.some((w) => w.id === walletId);
  const step3Done = step2Done && !!category;
  const step4Done = step3Done && !!date && !Number.isNaN(new Date(date).getTime());

  const validate = useCallback((): Errors => {
    const next: Errors = {};
    if (!numeric) next.amount = "Nominal wajib diisi.";
    else if (numeric > AMOUNT_MAX) next.amount = "Nominal terlalu besar.";
    if (!walletId) next.wallet = "Pilih akun dompet.";
    else if (!wallets.some((w) => w.id === walletId)) next.wallet = "Akun dompet tidak valid.";
    else if (type === "expense") {
      const wallet = wallets.find((w) => w.id === walletId);
      if (wallet && wallet.balance < numeric) next.wallet = "Saldo akun tidak mencukupi.";
    }
    if (!category) next.category = "Kategori wajib dipilih.";
    if (!date || Number.isNaN(new Date(date).getTime())) next.date = "Tanggal tidak valid.";
    return next;
  }, [numeric, walletId, wallets, type, category, date]);

  const liveErrors = useMemo(
    () => (submitted ? validate() : errors),
    [submitted, validate, errors],
  );

  const reset = () => {
    setAmount("");
    setNote("");
    setCategory("");
    setWalletId("");
    setWalletType(null);
    setDate(todayInput());
    setType("expense");
    setErrors({});
    setSubmitted(false);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = validate();
    setSubmitted(true);
    setErrors(next);
    if (Object.keys(next).length) return;
    addTransaction({
      type,
      amount: numeric,
      category,
      note: trimmedNote.slice(0, NOTE_MAX),
      date: new Date(date).toISOString(),
      walletId,
    });
    reset();
    setAddTxOpen(false);
  };

  const pickType = (next: TxType) => {
    setType(next);
    setCategory("");
  };

  if (!addTxOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Tambah transaksi"
    >
      <form
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        noValidate
        className="glass-card no-scrollbar max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[28px] px-margin-main pb-8 pt-4"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-outline/50" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-title text-on-surface">Tambah Transaksi</h2>
          <button
            type="button"
            aria-label="Tutup"
            data-testid="add-tx-close"
            onClick={close}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-variant text-on-surface-variant"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div
          className="mb-4 grid grid-cols-2 gap-2 rounded-full bg-surface-container p-1"
          role="tablist"
          aria-label="Jenis transaksi"
        >
          {(["income", "expense"] as TxType[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={type === t}
              onClick={() => pickType(t)}
              className={`rounded-full py-2 text-sm font-semibold transition-colors ${
                type === t
                  ? t === "income"
                    ? "bg-success/20 text-success"
                    : "bg-error/20 text-error"
                  : "text-on-surface-variant"
              }`}
            >
              {t === "income" ? "Pemasukan" : "Pengeluaran"}
            </button>
          ))}
        </div>

        {/* Step 1 — Amount */}
        <StepLabel htmlFor="tx-amount" text="Nominal" />
        <div
          className={`mt-1 rounded-[20px] border bg-surface-container-low px-4 py-3 transition-colors ${
            liveErrors.amount
              ? "border-error"
              : numeric
                ? "border-primary/50"
                : "border-outline-variant/30"
          }`}
        >
          <div className="flex items-baseline gap-2">
            <span className="shrink-0 text-[13px] font-semibold text-on-surface-variant">Rp</span>
            <input
              id="tx-amount"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              data-testid="tx-amount-input"
              aria-invalid={!!liveErrors.amount}
              aria-describedby="tx-amount-error tx-amount-hint"
              value={numeric ? numeric.toLocaleString("id-ID") : ""}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 15))}
              className={`w-full min-w-0 bg-transparent text-right text-[28px] font-extrabold leading-none tabular-nums tracking-tight outline-none placeholder:text-outline ${
                numeric ? (type === "income" ? "text-success" : "text-error") : "text-on-surface"
              }`}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-outline-variant/20 pt-2">
            <span
              id="tx-amount-hint"
              aria-live="polite"
              className="min-w-0 truncate text-[11px] font-medium text-on-surface-variant/80"
            >
              {numeric ? formatIDR(numeric) : "Masukkan nominal transaksi"}
            </span>
            <span className="flex shrink-0 gap-1">
              {[10_000, 50_000, 100_000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  data-testid={`tx-amount-preset-${preset}`}
                  onClick={() =>
                    setAmount((prev) =>
                      String(Math.min((Number(prev.replace(/\D/g, "")) || 0) + preset, AMOUNT_MAX)),
                    )
                  }
                  className="rounded-full border border-outline-variant/30 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-on-surface-variant transition-colors active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  {`+${preset / 1000}rb`}
                </button>
              ))}
            </span>
          </div>
        </div>
        <InlineError id="tx-amount-error" message={liveErrors.amount} />

        {/* Step 2 — Wallet type then registered sub-account */}
        <Step enabled={step1Done} hint="Isi nominal terlebih dahulu.">
          <StepLabel text="Akun Dompet" />
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Jenis akun">
            {ALLOWED_WALLET_TYPES.map((t) => {
              const active = walletType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`tx-wallet-type-${t.value}`}
                  onClick={() => {
                    setWalletType(t.value);
                    setWalletId("");
                    setCategory("");
                  }}
                  className={`flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 text-center transition-colors ${
                    active
                      ? "border-primary bg-primary-container/25 text-primary"
                      : "border-outline-variant/30 text-on-surface-variant"
                  }`}
                >
                  <Icon name={t.icon} className="text-[20px]" fill={active ? 1 : 0} />
                  <span className="text-[11px] font-semibold leading-tight">
                    {WALLET_TYPE_LABEL[t.value]}
                  </span>
                </button>
              );
            })}
          </div>

          {walletType ? (
            subWallets.length ? (
              <div
                className="mt-2 flex flex-col gap-2"
                role="radiogroup"
                aria-label="Akun terdaftar"
              >
                {subWallets.map((w) => {
                  const active = walletId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-testid={`tx-wallet-${w.id}`}
                      onClick={() => {
                        setWalletId(w.id);
                        setCategory("");
                      }}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary-container/20"
                          : "border-outline-variant/30"
                      }`}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-semibold text-on-surface">
                          {w.name}
                        </span>
                        <span className="truncate text-[11px] text-on-surface-variant/80">
                          {w.provider ?? WALLET_TYPE_LABEL[w.type]}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-on-surface">
                        {formatIDR(w.balance)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-on-surface-variant/70">
                Belum ada akun {WALLET_TYPE_LABEL[walletType]}. Tambahkan di halaman Dompet.
              </p>
            )
          ) : null}
          <InlineError id="tx-wallet-error" message={liveErrors.wallet} />
        </Step>

        {/* Step 3 — Category (user-managed, may be account-specific) */}
        <Step enabled={step2Done} hint="Pilih akun dompet terlebih dahulu.">
          <StepLabel text="Kategori" />
          {availableCategories.length ? (
            <div className="mt-2 flex gap-2 swipe-x" role="group" aria-label="Kategori">
              {availableCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={category === c.name}
                  onClick={() => setCategory(c.name)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                    category === c.name
                      ? "border-primary bg-primary-container/25 text-primary"
                      : "border-outline-variant/30 text-on-surface-variant"
                  }`}
                >
                  {c.name}
                  {c.walletId ? " •" : ""}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-on-surface-variant/70">
              Belum ada kategori. Tambahkan di Pengaturan → Kategori Transaksi.
            </p>
          )}
          <InlineError id="tx-category-error" message={liveErrors.category} />
        </Step>

        {/* Step 4 — Date */}
        <Step enabled={step3Done} hint="Pilih kategori terlebih dahulu.">
          <StepLabel htmlFor="tx-date" text="Tanggal" />
          <input
            id="tx-date"
            type="date"
            value={date}
            data-testid="tx-date-input"
            aria-invalid={!!liveErrors.date}
            aria-describedby="tx-date-error"
            onChange={(e) => setDate(e.target.value)}
            className={`mt-1 w-full rounded-[16px] border bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none ${
              liveErrors.date ? "border-error" : "border-outline-variant/30"
            }`}
          />
          <InlineError id="tx-date-error" message={liveErrors.date} />
        </Step>

        {/* Step 5 — Optional note */}
        <Step enabled={step4Done} hint="Isi tanggal terlebih dahulu.">
          <StepLabel htmlFor="tx-note" text="Catatan Singkat (opsional)" />
          <input
            id="tx-note"
            value={note}
            maxLength={NOTE_MAX}
            data-testid="tx-note-input"
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              type === "income" ? "Contoh: Gaji bulan ini" : "Contoh: Bensin motor harian"
            }
            className="mt-1 w-full rounded-[16px] border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none placeholder:text-outline"
          />
        </Step>

        <button
          type="submit"
          data-testid="tx-submit"
          disabled={!step4Done}
          className="gradient-primary mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-on-primary-container shadow-glow transition-opacity disabled:opacity-40"
        >
          <Icon name="check" className="text-[20px]" /> Simpan Transaksi
        </button>
      </form>
    </div>
  );
}

function StepLabel({ text, htmlFor }: { text: string; htmlFor?: string }) {
  if (htmlFor) {
    return (
      <label className="mt-4 block text-label uppercase text-on-surface-variant" htmlFor={htmlFor}>
        {text}
      </label>
    );
  }
  return <span className="mt-4 block text-label uppercase text-on-surface-variant">{text}</span>;
}

function Step({
  enabled,
  hint,
  children,
}: {
  enabled: boolean;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset
      disabled={!enabled}
      aria-disabled={!enabled}
      className={`m-0 border-0 p-0 transition-opacity ${enabled ? "opacity-100" : "opacity-40"}`}
    >
      {children}
      {!enabled ? <p className="mt-1 text-[11px] text-on-surface-variant/70">{hint}</p> : null}
    </fieldset>
  );
}

function InlineError({ id, message }: { id: string; message?: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-[11px] font-semibold text-error">
      {message}
    </p>
  );
}
