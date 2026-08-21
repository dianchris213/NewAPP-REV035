import { memo, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Icon } from "./Icon";
import { useModalA11y } from "@/hooks/use-modal-a11y";
import { formatIDR, useApp, type Transaction } from "@/lib/app-store";

const NOTE_MAX = 80;
const AMOUNT_MAX = 1_000_000_000_000;

type PendingAction =
  | { kind: "delete"; tx: Transaction }
  | { kind: "edit"; tx: Transaction; patch: { amount: number; category: string; note: string } };

const TransactionRow = memo(function TransactionRow({
  t,
  onSelect,
  actions,
}: {
  t: Transaction;
  onSelect: (t: Transaction) => void;
  actions: boolean;
}) {
  const content = (
    <>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          t.type === "income" ? "bg-success/15 text-success" : "bg-error/15 text-error"
        }`}
      >
        <Icon
          name={t.type === "income" ? "south_west" : "north_east"}
          className="text-[18px]"
          fill={1}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-body font-medium text-on-surface">{t.category}</span>
        {t.note ? (
          <span className="truncate text-meta text-on-surface-variant">{t.note}</span>
        ) : null}
        <span className="truncate text-meta text-on-surface-variant/60">
          {new Date(t.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
          {t.pending ? " · menyimpan..." : ""}
        </span>
      </div>
      <span
        className={`shrink-0 text-body font-semibold ${
          t.type === "income" ? "text-success" : "text-error"
        }`}
      >
        {t.type === "income" ? "+" : "-"}
        {formatIDR(t.amount)}
      </span>
      {actions ? (
        <Icon
          name="more_horiz"
          className="shrink-0 text-[18px] text-on-surface-variant/60"
          aria-hidden="true"
        />
      ) : null}
    </>
  );

  return (
    <li
      className={`border-b border-outline-variant/20 last:border-0 transition-opacity ${
        t.pending ? "opacity-60" : "opacity-100"
      }`}
    >
      {actions ? (
        <button
          type="button"
          data-testid={`tx-row-${t.id}`}
          aria-haspopup="dialog"
          aria-label={`Aksi transaksi ${t.category} ${formatIDR(t.amount)}`}
          disabled={!!t.pending}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(t);
          }}
          className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-surface-variant/25 focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-3 py-3">{content}</div>
      )}
    </li>
  );
});

/**
 * Transaction list with a lightweight bottom action sheet and strict two-step
 * confirmation: step 1 opens the edit form / delete warning, step 2 requires an
 * explicit final confirmation before the store is mutated.
 */
export const TransactionList = memo(function TransactionList({
  items,
  actions = false,
}: {
  items: Transaction[];
  /** Tap-to-act controls are opt-in per surface. */
  actions?: boolean;
}) {
  const { updateTransaction, deleteTransaction } = useApp();
  const [sheetTx, setSheetTx] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const closeSheet = useCallback(() => setSheetTx(null), []);

  const startEdit = useCallback((t: Transaction) => {
    setSheetTx(null);
    setPending(null);
    setEditing(t);
  }, []);

  const startDelete = useCallback((t: Transaction) => {
    setSheetTx(null);
    setEditing(null);
    setPending({ kind: "delete", tx: t });
  }, []);

  const confirm = useCallback(() => {
    if (!pending) return;
    if (pending.kind === "delete") {
      deleteTransaction(pending.tx.id);
      toast.success("Transaksi dihapus", {
        description: `${pending.tx.category} · ${formatIDR(pending.tx.amount)}`,
      });
    } else {
      updateTransaction(pending.tx.id, pending.patch);
      toast.success("Perubahan tersimpan", {
        description: `${pending.patch.category} · ${formatIDR(pending.patch.amount)}`,
      });
    }
    setPending(null);
    setEditing(null);
  }, [pending, deleteTransaction, updateTransaction]);

  return (
    <>
      <ul className="glass-card overflow-hidden rounded-[18px] px-4">
        {items.map((t) => (
          <TransactionRow key={t.id} t={t} actions={actions} onSelect={setSheetTx} />
        ))}
      </ul>

      {sheetTx ? (
        <ActionSheet
          tx={sheetTx}
          onClose={closeSheet}
          onEdit={() => startEdit(sheetTx)}
          onDelete={() => startDelete(sheetTx)}
        />
      ) : null}

      {editing ? (
        <EditDialog
          tx={editing}
          onCancel={() => setEditing(null)}
          onRequestConfirm={(patch) => setPending({ kind: "edit", tx: editing, patch })}
        />
      ) : null}

      {pending ? (
        <ConfirmDialog
          title={pending.kind === "delete" ? "Hapus transaksi?" : "Simpan perubahan?"}
          description={
            pending.kind === "delete"
              ? `Transaksi ${pending.tx.category} sebesar ${formatIDR(pending.tx.amount)} akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`
              : `Nominal menjadi ${formatIDR(pending.patch.amount)} pada kategori ${pending.patch.category}. Lanjutkan?`
          }
          confirmLabel={pending.kind === "delete" ? "Ya, hapus" : "Ya, simpan"}
          destructive={pending.kind === "delete"}
          onCancel={() => setPending(null)}
          onConfirm={confirm}
        />
      ) : null}
    </>
  );
});

/** Lightweight bottom action sheet: edit / delete for one transaction. */
function ActionSheet({
  tx,
  onEdit,
  onDelete,
  onClose,
}: {
  tx: Transaction;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(true, onClose);
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[195] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Aksi transaksi ${tx.category}`}
        data-testid="tx-action-sheet"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-[26px] border-t border-outline-variant/20 bg-surface-container-high p-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] shadow-2xl"
      >
        <span
          aria-hidden="true"
          className="mx-auto mb-3 block h-1 w-10 rounded-full bg-outline-variant/60"
        />
        <div className="mb-3 flex min-w-0 items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              tx.type === "income" ? "bg-success/15 text-success" : "bg-error/15 text-error"
            }`}
          >
            <Icon
              name={tx.type === "income" ? "south_west" : "north_east"}
              className="text-[18px]"
              fill={1}
            />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-body font-semibold text-on-surface">{tx.category}</span>
            <span className="truncate text-meta text-on-surface-variant/80">
              {formatIDR(tx.amount)}
              {tx.note ? ` · ${tx.note}` : ""}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            autoFocus
            data-testid={`tx-edit-${tx.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex h-12 w-full items-center gap-3 rounded-2xl bg-surface-variant/60 px-4 text-[14px] font-semibold text-on-surface transition-transform active:scale-[0.99]"
          >
            <Icon name="edit_square" className="text-[19px] text-primary" />
            Ubah Transaksi
          </button>
          <button
            type="button"
            data-testid={`tx-delete-${tx.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex h-12 w-full items-center gap-3 rounded-2xl bg-error/10 px-4 text-[14px] font-semibold text-error transition-transform active:scale-[0.99]"
          >
            <Icon name="delete_outline" className="text-[19px]" />
            Hapus Transaksi
          </button>
          <button
            type="button"
            data-testid="tx-sheet-cancel"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="h-12 w-full rounded-2xl text-[13px] font-semibold text-on-surface-variant transition-transform active:scale-[0.99]"
          >
            Batal
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(true, onCancel);
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        data-testid="tx-confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        className="glass-card w-full max-w-sm rounded-[22px] p-5"
      >
        <h3 className="m-0 text-title text-on-surface">{title}</h3>
        <p className="mt-2 text-[13px] leading-snug text-on-surface-variant">{description}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            autoFocus
            data-testid="tx-confirm-cancel"
            onClick={onCancel}
            className="h-11 flex-1 rounded-full bg-surface-variant text-[13px] font-semibold text-on-surface-variant transition-transform active:scale-95"
          >
            Batal
          </button>
          <button
            type="button"
            data-testid="tx-confirm-accept"
            onClick={onConfirm}
            className={`h-11 flex-1 rounded-full text-[13px] font-bold transition-transform active:scale-95 ${
              destructive ? "bg-error text-on-error" : "gradient-primary text-on-primary-container"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditDialog({
  tx,
  onRequestConfirm,
  onCancel,
}: {
  tx: Transaction;
  onRequestConfirm: (patch: { amount: number; category: string; note: string }) => void;
  onCancel: () => void;
}) {
  const ref = useModalA11y<HTMLDivElement>(true, onCancel);
  const [amount, setAmount] = useState(String(tx.amount));
  const [category, setCategory] = useState(tx.category);
  const [note, setNote] = useState(tx.note ?? "");
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(amount.replace(/\D/g, "")) || 0;
    if (numeric <= 0) return setError("Nominal harus lebih besar dari 0.");
    if (numeric > AMOUNT_MAX) return setError("Nominal terlalu besar.");
    if (!category.trim()) return setError("Kategori wajib diisi.");
    setError(undefined);
    onRequestConfirm({
      amount: numeric,
      category: category.trim(),
      note: note.trim().slice(0, NOTE_MAX),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[190] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Ubah transaksi"
        data-testid="tx-edit-dialog"
        onClick={(e) => e.stopPropagation()}
        className="glass-card w-full max-w-sm rounded-[22px] p-5"
      >
        <h3 className="m-0 text-title text-on-surface">Ubah Transaksi</h3>
        <form className="mt-4 flex flex-col gap-3" onSubmit={submit} noValidate>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-on-surface-variant/80">Nominal</span>
            <input
              inputMode="numeric"
              autoFocus
              data-testid="tx-edit-amount"
              aria-invalid={!!error}
              value={(Number(amount.replace(/\D/g, "")) || 0).toLocaleString("id-ID")}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 15))}
              className="h-11 rounded-2xl border border-outline-variant/30 bg-surface-container-high px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-on-surface-variant/80">Kategori</span>
            <input
              data-testid="tx-edit-category"
              value={category}
              maxLength={40}
              onChange={(e) => setCategory(e.target.value)}
              className="h-11 rounded-2xl border border-outline-variant/30 bg-surface-container-high px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-on-surface-variant/80">Catatan</span>
            <input
              data-testid="tx-edit-note"
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              className="h-11 rounded-2xl border border-outline-variant/30 bg-surface-container-high px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          </label>
          {error ? (
            <p role="alert" className="m-0 text-[11px] font-semibold text-error">
              {error}
            </p>
          ) : null}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-11 flex-1 rounded-full bg-surface-variant text-[13px] font-semibold text-on-surface-variant transition-transform active:scale-95"
            >
              Batal
            </button>
            <button
              type="submit"
              data-testid="tx-edit-continue"
              className="gradient-primary h-11 flex-1 rounded-full text-[13px] font-bold text-on-primary-container transition-transform active:scale-95"
            >
              Lanjut
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
