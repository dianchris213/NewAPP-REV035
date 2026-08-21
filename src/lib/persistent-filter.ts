import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Small, dependency-free persisted state for UI filters (search text, type
 * filter). SSR-safe: reads localStorage only after mount, so hydration never
 * mismatches. Values are validated before use — corrupt storage falls back to
 * the initial value instead of crashing the sheet.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  validate: (value: unknown) => value is T,
) {
  const [value, setValue] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const initialRef = useRef(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (validate(parsed)) setValue(parsed);
      }
    } catch {
      /* ignore unreadable storage */
    }
    setRestored(true);
    // validate is intentionally not a dependency: it is a stable type guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!restored) return;
    try {
      // A value back at its neutral default is not worth persisting: keeping
      // storage empty means a reset truly clears the filter keys.
      if (JSON.stringify(value) === JSON.stringify(initialRef.current)) {
        window.localStorage.removeItem(key);
      } else {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      /* ignore quota errors */
    }
  }, [key, value, restored]);

  const reset = useCallback(() => {
    setValue(initialRef.current);
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    // initial is a literal in every call site.
  }, [key]);

  return [value, setValue, reset, restored] as const;
}

export const isString = (v: unknown): v is string => typeof v === "string";

export function isOneOf<T extends string>(options: readonly T[]) {
  return (v: unknown): v is T =>
    typeof v === "string" && (options as readonly string[]).includes(v);
}
