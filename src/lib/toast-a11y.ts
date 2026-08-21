/**
 * Accessible toast layer.
 *
 * Sonner renders toasts in a portal outside the current focus context, so an
 * error toast that appears (or is dismissed/auto-closed) can leave keyboard
 * focus on `<body>` — the user loses their place and has to Tab from the top.
 *
 * `toastError` / `toastSuccess` capture the element that was focused when the
 * toast was raised and restore it *only* if focus was actually lost (body,
 * documentElement, or a node that got detached, e.g. the toast itself). If the
 * user moved on to another control in the meantime, nothing is touched — the
 * toast never steals or hijacks navigation.
 */
import { toast } from "sonner";

type ToastOptions = {
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
  onAutoClose?: () => void;
};

function currentFocus(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  if (active === document.body || active === document.documentElement) return null;
  return active;
}

function focusLost(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (!active) return true;
  if (active === document.body || active === document.documentElement) return true;
  return !active.isConnected;
}

/** Restore focus to `opener` when, and only when, focus was lost. */
export function restoreFocus(opener: HTMLElement | null) {
  if (!opener || !opener.isConnected || !focusLost()) return;
  opener.focus({ preventScroll: true });
}

/**
 * De-duplication: a rapidly repeated event (double click, retry storm, a
 * failing request answered twice) must not stack identical toasts. Each
 * kind+message pair gets a stable sonner id, so a repeat *updates* the
 * existing toast instead of pushing a new node. That also keeps focus stable:
 * the toast the user may be interacting with is never unmounted and rebuilt,
 * and the recorded opener is kept from the first raise, so the focus return
 * target cannot drift to a node that has since been detached.
 */
const RECENT_WINDOW_MS = 600;

type LiveToast = { id: string; opener: HTMLElement | null; at: number };

const live = new Map<string, LiveToast>();

const keyOf = (kind: string, message: string, description?: string) =>
  `${kind}::${message}::${description ?? ""}`;

/** Test-only escape hatch: clears the de-duplication bookkeeping. */
export function resetToastDedupe() {
  live.clear();
}

function withFocusReturn(
  kind: "error" | "success" | "info",
  message: string,
  options: ToastOptions = {},
) {
  const key = keyOf(kind, message, options.description);
  const now = Date.now();
  const existing = live.get(key);
  const fresh = existing && now - existing.at < RECENT_WINDOW_MS;

  // Reuse the opener recorded on the first raise while the toast is still
  // relevant; otherwise capture the currently focused control.
  const opener = fresh && existing?.opener?.isConnected ? existing.opener : currentFocus();
  const id = existing?.id ?? key;
  live.set(key, { id, opener, at: now });

  const settle = () => {
    if (live.get(key)?.id === id) live.delete(key);
    restoreFocus(opener);
  };

  return toast[kind](message, {
    ...options,
    id,
    onDismiss: () => {
      options.onDismiss?.();
      settle();
    },
    onAutoClose: () => {
      options.onAutoClose?.();
      settle();
    },
  });
}

export const toastError = (message: string, options?: ToastOptions) =>
  withFocusReturn("error", message, options);

export const toastSuccess = (message: string, options?: ToastOptions) =>
  withFocusReturn("success", message, options);

export const toastInfo = (message: string, options?: ToastOptions) =>
  withFocusReturn("info", message, options);
