import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Hidden detection that does not depend on a layout engine.
 *
 * `offsetParent` alone reported *every* element as hidden in jsdom-based
 * tests, which collapsed the trap to a single node and made Tab appear stuck.
 * Style/attribute inspection behaves identically in the browser and in tests.
 */
function isHidden(el: HTMLElement): boolean {
  if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return true;
  if (el.closest('[hidden],[aria-hidden="true"]')) return true;
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return true;
  }
  return false;
}

function focusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el === document.activeElement || !isHidden(el),
  );
}

/**
 * Bank-grade modal accessibility: focus moves into the dialog on open, Esc
 * closes, Tab/Shift+Tab are trapped inside the container, and focus returns to
 * the opener element on close.
 *
 * `onClose` is read through a ref so inline handlers cannot re-run the effect
 * on every render (which would bounce focus back to the opener).
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
) {
  const containerRef = useRef<T | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Portalled sheets mount a frame later, so retry for a few frames.
    let raf = 0;
    let attempts = 0;
    const focusIn = () => {
      const root = containerRef.current;
      if (!root || !root.isConnected) {
        if (attempts++ < 20) raf = requestAnimationFrame(focusIn);
        return;
      }
      if (root.contains(document.activeElement)) return;
      const preferred = root.querySelector<HTMLElement>("[data-autofocus]");
      const target = preferred ?? focusable(root)[0] ?? root;
      if (target === root && !root.hasAttribute("tabindex")) root.setAttribute("tabindex", "-1");
      target.focus?.();
    };
    raf = requestAnimationFrame(focusIn);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = focusable(containerRef.current);
      if (!nodes.length) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (!containerRef.current?.contains(active ?? null)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown, true);
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener?.isConnected) {
        requestAnimationFrame(() => opener.focus?.());
      }
    };
  }, [open]);

  return containerRef;
}
