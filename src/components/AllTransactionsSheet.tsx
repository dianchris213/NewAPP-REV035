import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { TransactionList } from "./TransactionList";
import { EmptyState } from "./EmptyState";
import { useApp, type Transaction } from "@/lib/app-store";

type SortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date-desc", label: "Terbaru" },
  { value: "date-asc", label: "Terlama" },
  { value: "amount-desc", label: "Nominal Tertinggi" },
  { value: "amount-asc", label: "Nominal Terendah" },
];

const WEEK_OPTIONS = [
  { value: "all", label: "Semua Minggu" },
  { value: "this", label: "Minggu Ini" },
  { value: "last", label: "Minggu Lalu" },
];

/** Monday 00:00 of the week containing `d`. */
function startOfWeek(d: Date) {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (s.getDay() + 6) % 7;
  s.setDate(s.getDate() - diff);
  return s;
}

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/**
 * True full-screen overlay listing every transaction.
 * Pure UI overlay: no routing, no URL change. Covers the bottom nav entirely;
 * closing is only possible through the X button.
 */
export function AllTransactionsSheet({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: Transaction[];
}) {
  // Filters live in the app store so selections persist across open/close.
  const { txFilters, setTxFilters, resetTxFilters } = useApp();
  const { month, week, type, category, keyword } = txFilters;
  const hasActiveFilters =
    month !== "all" ||
    week !== "all" ||
    type !== "all" ||
    category !== "all" ||
    keyword.trim() !== "";

  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<SortKey>("date-desc");
  const closingRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // A11y: move keyboard focus to the search field as soon as the sheet opens.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Cleanup: when the sheet closes, purge every filter and collapse the panel
  // so no phantom state survives into the next open.
  useEffect(() => {
    if (open) {
      closingRef.current = false;
      return;
    }
    setShowFilters(false);
    resetTxFilters();
  }, [open, resetTxFilters]);

  const handleReset = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      resetTxFilters();
    },
    [resetTxFilters],
  );

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // Guard against rapid double-clicks triggering close twice.
      if (closingRef.current) return;
      closingRef.current = true;
      setShowFilters(false);
      onClose();
    },
    [onClose],
  );

  const categories = useMemo(
    () => Array.from(new Set(items.map((t) => t.category))).sort(),
    [items],
  );

  const filtered = useMemo(
    () =>
      items.filter((t) => {
        if (type !== "all" && t.type !== type) return false;
        if (category !== "all" && t.category !== category) return false;
        if (month !== "all" && String(new Date(t.date).getMonth()) !== month) return false;
        if (week !== "all") {
          const thisStart = startOfWeek(new Date());
          const start = new Date(thisStart);
          if (week === "last") start.setDate(start.getDate() - 7);
          const end = new Date(start);
          end.setDate(end.getDate() + 7);
          const ts = new Date(t.date).getTime();
          if (ts < start.getTime() || ts >= end.getTime()) return false;
        }
        const q = keyword.trim().toLowerCase();
        if (q) {
          const amountRaw = String(t.amount ?? "");
          const amountFmt = Number(t.amount ?? 0).toLocaleString("id-ID");
          const haystack = `${t.category} ${t.note ?? ""} ${amountRaw} ${amountFmt}`.toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      }),
    [items, month, week, type, category, keyword],
  );

  // Sorting is derived from the already-filtered list, so search + sort stay
  // in sync and update instantly on every keystroke or option change.
  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      switch (sort) {
        case "date-asc":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "amount-desc":
          return b.amount - a.amount;
        case "amount-asc":
          return a.amount - b.amount;
        default:
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });
    return copy;
  }, [filtered, sort]);

  // Reset sorting when the sheet closes so no phantom state survives.
  useEffect(() => {
    if (!open) setSort("date-desc");
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Semua transaksi"
    >
      <div className="flex items-center justify-between border-b border-outline-variant/15 px-margin-main pt-safe-area-top pb-3">
        <div className="flex flex-col">
          <h2 className="text-title text-on-surface">Semua Transaksi</h2>
          <span className="text-meta text-on-surface-variant/80">{sorted.length} entri</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Tutup"
            data-testid="tx-close-button"
            onClick={handleClose}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-variant text-on-surface-variant transition-transform active:scale-95"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-margin-main pt-3">
        <button
          type="button"
          aria-expanded={showFilters}
          aria-controls="tx-filter-panel"
          data-testid="tx-filter-toggle"
          onClick={() => setShowFilters((v) => !v)}
          className="flex h-11 min-w-[48px] flex-1 items-center justify-center gap-1.5 rounded-full border border-outline-variant/30 bg-surface-container-high px-4 text-[12px] font-semibold text-on-surface-variant transition-transform active:scale-95"
        >
          <Icon name="filter_alt" className="text-[18px]" fill={hasActiveFilters ? 1 : 0} />
          {showFilters ? "Sembunyikan Filter" : "Tampilkan Filter"}
          {hasActiveFilters ? (
            <span className="ml-1 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
          ) : null}
          <Icon
            name="expand_more"
            className={`text-[18px] transition-transform duration-300 ${showFilters ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      <div
        id="tx-filter-panel"
        aria-hidden={!showFilters}
        className={`grid px-margin-main transition-[grid-template-rows,opacity] duration-300 ease-out ${
          showFilters ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-4">
            <FilterSelect
              label="Bulan"
              value={month}
              onChange={(v) => setTxFilters({ month: v })}
              options={[
                { value: "all", label: "Semua Bulan" },
                ...MONTHS.map((m, i) => ({ value: String(i), label: m })),
              ]}
            />
            <FilterSelect
              label="Mingguan"
              value={week}
              onChange={(v) => setTxFilters({ week: v })}
              options={WEEK_OPTIONS}
            />
            <FilterSelect
              label="Jenis"
              value={type}
              onChange={(v) => setTxFilters({ type: v as "all" | "income" | "expense" })}
              options={[
                { value: "all", label: "Semua Jenis" },
                { value: "income", label: "Pemasukan" },
                { value: "expense", label: "Pengeluaran" },
              ]}
            />
            <FilterSelect
              label="Kategori"
              value={category}
              onChange={(v) => setTxFilters({ category: v })}
              options={[
                { value: "all", label: "Semua Kategori" },
                ...categories.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>
          <button
            type="button"
            aria-label="Reset filter"
            data-testid="tx-reset-button"
            disabled={!hasActiveFilters}
            onClick={handleReset}
            className="mt-3 flex h-11 w-full items-center justify-center gap-1 rounded-full bg-surface-variant px-3 text-[12px] font-semibold text-on-surface-variant transition-transform active:scale-95 disabled:opacity-40"
          >
            <Icon name="restart_alt" className="text-[18px]" />
            Reset Filter
          </button>
        </div>
      </div>

      <div className="px-margin-main pb-3">
        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant/70"
          />
          <input
            ref={searchRef}
            type="search"
            data-testid="tx-search-input"
            value={keyword}
            onChange={(e) => setTxFilters({ keyword: e.target.value })}
            placeholder="Cari kategori, catatan, atau nominal..."
            aria-label="Cari transaksi"
            className="h-11 w-full rounded-full border border-outline-variant/30 bg-surface-container-high pl-10 pr-4 text-[13px] text-on-surface outline-none placeholder:text-on-surface-variant/60 focus-visible:ring-2 focus-visible:ring-primary/60"
          />
        </div>
      </div>

      <div
        className="no-scrollbar swipe-x flex gap-2 px-margin-main pb-3"
        role="radiogroup"
        aria-label="Urutkan transaksi"
      >
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={sort === o.value}
            tabIndex={sort === o.value ? 0 : -1}
            data-testid={`tx-sort-${o.value}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
                e.preventDefault();
                setSort(o.value);
              }
            }}
            onClick={() => setSort(o.value)}
            className={`h-10 shrink-0 rounded-full border px-4 text-[12px] font-semibold transition-colors ${
              sort === o.value
                ? "border-primary bg-primary-container/25 text-primary"
                : "border-outline-variant/30 text-on-surface-variant"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <p aria-live="polite" role="status" className="sr-only">
        {`Diurutkan ${SORT_OPTIONS.find((o) => o.value === sort)?.label ?? ""}, ${sorted.length} transaksi ditampilkan.`}
      </p>

      <div className="no-scrollbar flex-1 overflow-y-auto px-margin-main pb-10">
        {sorted.length ? (
          <TransactionList items={sorted} actions />
        ) : (
          <EmptyState icon="receipt" title="Tidak ada transaksi" />
        )}
      </div>
    </div>,
    document.body,
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant/70">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full min-w-0 rounded-full border border-outline-variant/30 bg-surface-container-high px-3 text-[12px] font-medium text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
