import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { BillingCalendar } from "./BillingCalendar";
import { DueDatePicker } from "./DueDatePicker";

import { useModalA11y } from "@/hooks/use-modal-a11y";
import { toastError, toastSuccess } from "@/lib/toast-a11y";
import { formatIDR, useApp } from "@/lib/app-store";
import {
  AMOUNT_ERROR,
  BILL_ICONS,
  billStatus,
  buildWhatsAppLink,
  computeTotals,
  daysUntilDue,
  formatDueDate,
  RECURRING_LABEL,
  STATUS_LABEL,
  formatAmountInput,
  sanitizeAmountInput,
  suggestBillIcon,
  validateAmountInput,
  type BillDraft,
  type DiscountMode,
  type RecurringInterval,
} from "@/lib/billing";

const RECURRING_OPTIONS: RecurringInterval[] = ["none", "weekly", "monthly", "yearly"];

const field =
  "h-12 w-full rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60";

const emptyDraft: BillDraft = {
  name: "",
  amount: "",
  dueDate: "",
  taxPercent: "",
  discountMode: "percent",
  discountValue: "",
  recurring: "monthly",
  phone: "",
  note: "",
};

const STATUS_TONE: Record<string, string> = {
  paid: "bg-primary-container/40 text-primary",
  overdue: "bg-error/15 text-error",
  "due-soon": "bg-surface-variant text-on-surface",
  upcoming: "bg-surface-container text-on-surface-variant",
};

/**
 * Tagihan Bulanan management. One strict validation gate (parseBillDraft in the
 * store) guards every write; the totals shown here come from the same pure
 * `computeTotals` used when persisting, so the grand total can never drift.
 */
export function BillingSheet({ onClose }: { onClose: () => void }) {
  const {
    bills,
    billingProfile,
    addBill,
    updateBill,
    deleteBill,
    markBillPaid,
    billIconPref,
    setBillIconPref,
  } = useApp();
  const ref = useModalA11y<HTMLDivElement>(true, onClose);
  const [draft, setDraft] = useState<BillDraft>(emptyDraft);
  const [amountError, setAmountError] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState("");
  /** Digits only; rendered with Indonesian thousand separators. */
  const amountDigits = sanitizeAmountInput(draft.amount);
  const activeIcon = draft.icon ?? (draft.name ? suggestBillIcon(draft.name) : billIconPref);

  /** The stored icon preference is restored whenever the sheet is reopened. */
  useEffect(() => {
    setDraft((prev) => (prev.icon ? prev : { ...prev, icon: billIconPref }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const totals = useMemo(
    () =>
      computeTotals({
        amount: Number(draft.amount) || 0,
        taxPercent: Number(draft.taxPercent) || 0,
        discountMode: draft.discountMode,
        discountValue: Number(draft.discountValue) || 0,
      }),
    [draft.amount, draft.taxPercent, draft.discountMode, draft.discountValue],
  );

  const summary = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;
    for (const bill of bills) {
      const billTotal = computeTotals(bill).total;
      if (bill.paid) continue;
      outstanding += billTotal;
      if (daysUntilDue(bill.dueDate) < 0) overdue += 1;
    }
    return { outstanding, overdue, count: bills.length };
  }, [bills]);

  const set = (patch: Partial<BillDraft>) => {
    setError(undefined);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  /** Selects an icon and remembers it as the user's default. */
  const selectIcon = (name: string) => {
    set({ icon: name });
    setBillIconPref(name);
  };

  /**
   * Radiogroup keyboard pattern: arrows/Home/End move (and select) within the
   * group, Space/Enter toggles the focused option. Tab always leaves the group.
   */
  const moveIconFocus = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = BILL_ICONS.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      selectIcon(BILL_ICONS[index]!.name);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    const target = BILL_ICONS[next]!.name;
    selectIcon(target);
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-testid="billing-icon-${target}"]`)?.focus();
    });
  };



  const announce = (message: string, ok: boolean) => {
    setStatus(message);
    if (ok) toastSuccess(message);
    else toastError(message);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const amount = validateAmountInput(formatAmountInput(draft.amount));
    if (!amount.ok) {
      const message = AMOUNT_ERROR[amount.reason];
      setAmountError(message);
      setError(message);
      announce(message, false);
      return;
    }
    setAmountError(undefined);
    const ok = editingId ? updateBill(editingId, draft) : addBill(draft);
    if (!ok) {
      const message = "Periksa nama, nominal, dan tanggal jatuh tempo tagihan.";
      setError(message);
      announce(message, false);
      return;
    }
    announce(editingId ? "Tagihan diperbarui." : "Tagihan ditambahkan.", true);
    setDraft({ ...emptyDraft, icon: activeIcon });
    setEditingId(null);
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
        aria-label="Tagihan Bulanan"
        data-testid="billing-sheet"
        onClick={(e) => e.stopPropagation()}
        className="no-scrollbar max-h-[88vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[26px] border-t border-outline-variant/20 bg-surface-container-high p-5 pb-[calc(env(safe-area-inset-bottom,0px)+120px)] shadow-2xl"
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-3 block h-1 w-10 rounded-full bg-outline-variant/60"
        />
        <div className="flex items-center justify-between">
          <h3 className="m-0 text-title text-on-surface">Tagihan Bulanan</h3>
          <button
            type="button"
            aria-label="Tutup"
            data-testid="billing-close"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-variant text-on-surface-variant"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        <div
          data-testid="billing-summary"
          className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-surface-container p-3"
        >
          <SummaryItem testId="billing-summary-total" label="Tagihan" value={String(summary.count)} />
          <SummaryItem
            testId="billing-summary-outstanding"
            label="Belum lunas"
            value={formatIDR(summary.outstanding)}
          />
          <SummaryItem
            testId="billing-summary-overdue"
            label="Terlambat"
            value={String(summary.overdue)}
          />
        </div>

        <form className="mt-4 flex flex-col gap-3" onSubmit={submit} noValidate>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-on-surface-variant/80">Nama tagihan</span>
            <input
              value={draft.name}
              minLength={2}
              maxLength={60}
              required
              aria-invalid={!!error}
              aria-label="Nama tagihan"
              data-testid="billing-name"
              onChange={(e) => set({ name: e.target.value })}
              className={field}
            />
          </label>

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 p-0 text-meta text-on-surface-variant/80">Ikon tagihan</legend>
            <div
              role="radiogroup"
              aria-label="Ikon tagihan"
              data-testid="billing-icon-group"
              className="flex flex-wrap gap-2"
            >
              {BILL_ICONS.map((option, index) => {
                const active = activeIcon === option.name;
                return (
                  <button
                    key={option.name}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={option.label}
                    title={option.label}
                    /* Roving tabindex: the radiogroup is a single Tab stop. */
                    tabIndex={active ? 0 : -1}
                    data-testid={`billing-icon-${option.name}`}
                    onKeyDown={(event) => moveIconFocus(event, index)}
                    onClick={() => selectIcon(option.name)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors focus-visible:ring-2 focus-visible:ring-primary/60 ${
                      active
                        ? "border-primary bg-primary-container/50 text-primary"
                        : "border-outline-variant/30 bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    <Icon name={option.name} className="text-[18px]" />
                  </button>
                );
              })}

            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-meta text-on-surface-variant/80">Nominal (Rp)</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={formatAmountInput(amountDigits)}
                required
                aria-label="Nominal tagihan"
                aria-invalid={!!amountError}
                aria-describedby={amountError ? "billing-amount-error" : undefined}
                data-testid="billing-amount"
                onChange={(e) => {
                  const digits = sanitizeAmountInput(e.target.value);
                  const check = validateAmountInput(formatAmountInput(digits));
                  setAmountError(check.ok || !digits ? undefined : AMOUNT_ERROR[check.reason]);
                  set({ amount: digits });
                }}
                onBlur={() => {
                  const check = validateAmountInput(formatAmountInput(amountDigits));
                  setAmountError(check.ok ? undefined : AMOUNT_ERROR[check.reason]);
                }}
                className={`${field} text-right font-bold tabular-nums ${
                  amountError ? "border-error" : ""
                }`}
              />
              {amountError ? (
                <span
                  id="billing-amount-error"
                  role="alert"
                  data-testid="billing-amount-error"
                  className="text-[11px] font-semibold text-error"
                >
                  {amountError}
                </span>
              ) : null}
            </label>

            <DueDatePicker value={draft.dueDate} onChange={(dueDate) => set({ dueDate })} />
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-meta text-on-surface-variant/80">Siklus penagihan</span>
            <select
              value={draft.recurring}
              aria-label="Siklus penagihan"
              data-testid="billing-recurring"
              onChange={(e) => set({ recurring: e.target.value as RecurringInterval })}
              className={field}
            >
              {RECURRING_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {RECURRING_LABEL[option]}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-meta text-on-surface-variant/80">Pajak (%)</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                value={draft.taxPercent}
                aria-label="Pajak persen"
                data-testid="billing-tax"
                onChange={(e) => set({ taxPercent: e.target.value })}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-meta text-on-surface-variant/80">Tipe diskon</span>
              <select
                value={draft.discountMode}
                aria-label="Tipe diskon"
                data-testid="billing-discount-mode"
                onChange={(e) => set({ discountMode: e.target.value as DiscountMode })}
                className={field}
              >
                <option value="percent">Persen</option>
                <option value="fixed">Nominal</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-meta text-on-surface-variant/80">
                {draft.discountMode === "percent" ? "Diskon (%)" : "Diskon (Rp)"}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={draft.discountValue}
                aria-label="Nilai diskon"
                data-testid="billing-discount-value"
                onChange={(e) => set({ discountValue: e.target.value })}
                className={field}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-meta text-on-surface-variant/80">Nomor WhatsApp (opsional)</span>
            <input
              type="tel"
              inputMode="tel"
              value={draft.phone}
              placeholder="08xxxxxxxxxx"
              aria-label="Nomor WhatsApp penerima"
              data-testid="billing-phone"
              onChange={(e) => set({ phone: e.target.value })}
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-meta text-on-surface-variant/80">Catatan (opsional)</span>
            <input
              value={draft.note}
              maxLength={160}
              aria-label="Catatan tagihan"
              data-testid="billing-note"
              onChange={(e) => set({ note: e.target.value })}
              className={field}
            />
          </label>

          <dl
            data-testid="billing-totals"
            className="m-0 grid grid-cols-2 gap-y-1 rounded-2xl bg-surface-container px-4 py-3 text-[12px] text-on-surface-variant"
          >
            <dt className="m-0">Subtotal</dt>
            <dd className="m-0 text-right" data-testid="billing-total-subtotal">
              {formatIDR(totals.subtotal)}
            </dd>
            <dt className="m-0">Diskon</dt>
            <dd className="m-0 text-right" data-testid="billing-total-discount">
              {`-${formatIDR(totals.discount)}`}
            </dd>
            <dt className="m-0">Pajak</dt>
            <dd className="m-0 text-right" data-testid="billing-total-tax">
              {formatIDR(totals.tax)}
            </dd>
            <dt className="m-0 pt-1 text-[13px] font-bold text-on-surface">Total</dt>
            <dd
              className="m-0 pt-1 text-right text-[13px] font-bold text-on-surface"
              data-testid="billing-total-grand"
            >
              {formatIDR(totals.total)}
            </dd>
          </dl>

          {error ? (
            <p role="alert" className="m-0 text-[11px] font-semibold text-error">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="submit"
              data-testid="billing-submit"
              className="gradient-primary h-12 flex-1 rounded-full text-[13px] font-bold text-on-primary-container transition-transform active:scale-95"
            >
              {editingId ? "Simpan perubahan" : "Tambah tagihan"}
            </button>
            {editingId ? (
              <button
                type="button"
                data-testid="billing-cancel-edit"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyDraft);
                }}
                className="h-12 rounded-full border border-outline-variant/40 px-4 text-[13px] font-semibold text-on-surface-variant"
              >
                Batal
              </button>
            ) : null}
          </div>
        </form>

        <p aria-live="polite" className="sr-only">
          {status}
        </p>

        <BillingCalendar bills={bills} />


        <section className="mt-5">
          <h4 className="m-0 mb-2 text-label uppercase text-primary">Daftar Tagihan</h4>
          {bills.length === 0 ? (
            <p
              data-testid="billing-empty"
              className="m-0 rounded-2xl bg-surface-container px-4 py-6 text-center text-[12px] text-on-surface-variant"
            >
              Belum ada tagihan. Tambahkan tagihan pertama Anda di atas.
            </p>
          ) : (
            <ul
              id="billing-list"
              aria-label="Daftar tagihan bulanan"
              className="m-0 flex list-none flex-col gap-2 p-0"
            >
              {bills.map((bill) => {
                const billTotals = computeTotals(bill);
                const state = billStatus(bill);
                return (
                  <li
                    key={bill.id}
                    data-testid={`billing-item-${bill.id}`}
                    className="rounded-2xl bg-surface-container p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-container/40"
                        >
                          <Icon name={bill.icon} className="text-[18px] text-primary" />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-[13px] font-semibold text-on-surface">
                            {bill.name}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            {`${formatDueDate(bill.dueDate)} · ${RECURRING_LABEL[bill.recurring]}`}
                          </span>
                        </span>
                      </div>

                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[13px] font-bold text-on-surface">
                          {formatIDR(billTotals.total)}
                        </span>
                        <span
                          data-testid={`billing-status-${bill.id}`}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[state]}`}
                        >
                          {STATUS_LABEL[state]}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a
                        href={buildWhatsAppLink(bill, billingProfile)}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`billing-wa-${bill.id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-primary-container/40 px-3 py-1.5 text-[11px] font-semibold text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <Icon name="send" className="text-[14px]" />
                        Kirim Pengingat WA
                      </a>
                      <button
                        type="button"
                        data-testid={`billing-paid-${bill.id}`}
                        onClick={() => {
                          markBillPaid(bill.id);
                          announce(
                            bill.recurring === "none"
                              ? "Tagihan ditandai lunas."
                              : "Tagihan lunas, jadwal berikutnya dibuat.",
                            true,
                          );
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-3 py-1.5 text-[11px] font-semibold text-on-surface focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <Icon name="task_alt" className="text-[14px]" />
                        Tandai Lunas
                      </button>
                      <button
                        type="button"
                        data-testid={`billing-edit-${bill.id}`}
                        onClick={() => {
                          setEditingId(bill.id);
                          setDraft({
                            name: bill.name,
                            amount: String(bill.amount),
                            dueDate: bill.dueDate,
                            taxPercent: String(bill.taxPercent),
                            discountMode: bill.discountMode,
                            discountValue: String(bill.discountValue),
                            recurring: bill.recurring,
                            icon: bill.icon,

                            phone: bill.phone ?? "",
                            note: bill.note ?? "",
                          });
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-surface-variant px-3 py-1.5 text-[11px] font-semibold text-on-surface focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <Icon name="edit" className="text-[14px]" />
                        Ubah
                      </button>
                      <button
                        type="button"
                        data-testid={`billing-delete-${bill.id}`}
                        onClick={() => {
                          deleteBill(bill.id);
                          if (editingId === bill.id) {
                            setEditingId(null);
                            setDraft(emptyDraft);
                          }
                          announce("Tagihan dihapus.", true);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-error/30 px-3 py-1.5 text-[11px] font-semibold text-error focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <Icon name="delete" className="text-[14px]" />
                        Hapus
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      tabIndex={0}
      role="group"
      aria-label={`${label}: ${value}`}
      className="flex flex-col rounded-xl px-2 py-1 outline-none transition-colors hover:bg-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <span className="text-[10px] uppercase text-on-surface-variant/80">{label}</span>
      <span className="truncate text-[12px] font-bold text-on-surface">{value}</span>
    </div>
  );
}
