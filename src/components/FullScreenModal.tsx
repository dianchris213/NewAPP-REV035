import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { useModalA11y } from "@/hooks/use-modal-a11y";

/**
 * Full-screen overlay that covers the bottom navbar.
 * Backdrop clicks are intentionally ignored; the X button or Escape closes it.
 * Focus moves into the dialog on open, Tab/Shift+Tab are trapped inside it and
 * focus returns to the opener on close.
 */
export function FullScreenModal({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const ref = useModalA11y<HTMLDivElement>(open, onClose);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={ref}
      data-testid="fullscreen-modal"
      className="fixed inset-0 z-[130] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex items-center justify-between border-b border-outline-variant/15 px-margin-main pt-safe-area-top pb-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-title text-on-surface">{title}</h2>
          {subtitle ? (
            <span className="truncate text-meta text-on-surface-variant/80">{subtitle}</span>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Tutup"
          data-testid="fullscreen-modal-close"
          data-autofocus
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-variant text-on-surface-variant transition-transform active:scale-95"
        >
          <Icon name="close" className="text-[20px]" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-margin-main py-4 pb-10">{children}</div>
    </div>,
    document.body,
  );
}
