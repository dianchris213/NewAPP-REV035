import { useCallback, useEffect, useRef } from "react";

const DRAG_THRESHOLD = 8;

/**
 * Horizontal swipe strip helper.
 *
 * - Mobile: fully native touch scrolling (we never touch touch events), so the
 *   strip stays 60fps smooth and taps on children are never intercepted.
 * - Desktop: click-and-drag scrolling with a generous threshold so a normal
 *   click (including on nested Edit/Delete buttons) always fires.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const state = useRef({ down: false, dragging: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      // Native scrolling for touch/pen: do not interfere at all.
      if (e.pointerType !== "mouse") return;
      if (e.button !== 0) return;
      state.current = {
        down: true,
        dragging: false,
        startX: e.clientX,
        scrollLeft: el.scrollLeft,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!state.current.down) return;
      const dx = e.clientX - state.current.startX;
      if (!state.current.dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        state.current.dragging = true;
        el.style.cursor = "grabbing";
      }
      el.scrollLeft = state.current.scrollLeft - dx;
    };

    const endDrag = () => {
      if (!state.current.down) return;
      state.current.down = false;
      el.style.cursor = "";
      // Reset after the click event has been evaluated.
      window.setTimeout(() => {
        state.current.dragging = false;
      }, 0);
    };

    // Only swallow the click when an actual drag happened.
    const onClickCapture = (e: MouseEvent) => {
      if (state.current.dragging) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);
    el.addEventListener("pointerleave", endDrag);
    el.addEventListener("click", onClickCapture, true);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", endDrag);
      el.removeEventListener("pointercancel", endDrag);
      el.removeEventListener("pointerleave", endDrag);
      el.removeEventListener("click", onClickCapture, true);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<T>) => {
    const el = ref.current;
    if (!el) return;
    if (e.key === "ArrowRight") {
      el.scrollBy({ left: 160, behavior: "smooth" });
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      el.scrollBy({ left: -160, behavior: "smooth" });
      e.preventDefault();
    }
  }, []);

  return { ref, onKeyDown };
}
