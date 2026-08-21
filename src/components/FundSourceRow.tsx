import { memo } from "react";
import { Icon } from "@/components/Icon";
import { WALLET_TYPE_LABEL, formatIDR, type Wallet } from "@/lib/app-store";
import type { Dict } from "@/lib/i18n";

export type FundSourceRowProps = {
  wallet: Wallet;
  /** Number of transactions referencing this fund source. */
  used: number;
  editing: boolean;
  editingName: string;
  /** Inline error for this row only. */
  message: string | null;
  pending: "rename" | "delete" | undefined;
  copy: Dict;
  /** Renders the sticky type heading above the first row of each group. */
  showTypeHeader: boolean;
  onStartRename: (id: string, name: string) => void;
  onEditingNameChange: (value: string) => void;
  onCommitRename: (id: string) => void;
  onCancelRename: () => void;
  onRequestDelete: (id: string) => void;
};

/**
 * A single fund source row. Memoized so that changing one row (or the wallet
 * array identity) never re-renders every sibling: identity is the wallet id,
 * never the display name, so two banks with the same name (BCA / BRI) stay
 * distinct rows.
 */
function FundSourceRowImpl({
  wallet: w,
  used,
  editing,
  editingName,
  message,
  pending,
  copy,
  showTypeHeader,
  onStartRename,
  onEditingNameChange,
  onCommitRename,
  onCancelRename,
  onRequestDelete,
}: FundSourceRowProps) {
  const busy = !!pending;
  return (
    <>
      {showTypeHeader ? (
        <li
          aria-hidden="true"
          className="pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant/70"
        >
          {WALLET_TYPE_LABEL[w.type]}
        </li>
      ) : null}
      <li
        data-testid={`fund-source-item-${w.id}`}
        data-fund-source-id={w.id}
        className="flex flex-col gap-2 border-b border-outline-variant/20 py-3 last:border-0"
      >
        <div className="flex items-center gap-3">
          {editing ? (
            <input
              autoFocus
              value={editingName}
              maxLength={24}
              aria-label={`${copy.renameFundSource} ${w.name}`}
              aria-invalid={!!message}
              data-testid={`fund-source-rename-input-${w.id}`}
              onChange={(e) => onEditingNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCommitRename(w.id);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  onCancelRename();
                }
              }}
              className="h-10 min-w-0 flex-1 rounded-2xl border border-outline-variant/30 bg-surface-container-high px-3 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          ) : (
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-on-surface">{w.name}</span>
              <span className="truncate text-[11px] text-on-surface-variant/80">
                {`${WALLET_TYPE_LABEL[w.type]} · ${formatIDR(w.balance)} · ${used}`}
              </span>
            </span>
          )}

          {editing ? (
            <>
              <button
                type="button"
                aria-label={copy.save}
                data-testid={`fund-source-rename-save-${w.id}`}
                disabled={busy}
                aria-busy={busy}
                onClick={() => onCommitRename(w.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container/40 text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Icon name="check" className="text-[18px]" />
              </button>
              <button
                type="button"
                aria-label={copy.cancel}
                onClick={onCancelRename}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-variant text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                aria-label={`${copy.rename} ${w.name}`}
                data-testid={`fund-source-rename-${w.id}`}
                onClick={() => onStartRename(w.id, w.name)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-variant text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Icon name="edit" className="text-[18px]" />
              </button>
              <button
                type="button"
                aria-label={`${copy.delete} ${w.name}`}
                data-testid={`fund-source-delete-${w.id}`}
                aria-disabled={used > 0}
                disabled={busy}
                aria-busy={busy}
                onClick={() => onRequestDelete(w.id)}
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
            data-testid={`fund-source-error-${w.id}`}
            className="m-0 text-[11px] font-semibold text-error"
          >
            {message}
          </p>
        ) : null}
      </li>
    </>
  );
}

export const FundSourceRow = memo(FundSourceRowImpl);
FundSourceRow.displayName = "FundSourceRow";
