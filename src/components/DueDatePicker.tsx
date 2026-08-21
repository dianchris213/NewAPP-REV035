import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { formatDueDate, isIsoDate } from "@/lib/billing";

const WEEKDAYS = ["S", "S", "R", "K", "J", "S", "M"];
const WEEKDAY_LABEL = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Due-date field: the manual `type="date"` input stays the source of truth
 * (typing still works) and a modern popover calendar offers point-and-click
 * selection with full WAI-ARIA grid keyboard support.
 */
export function DueDatePicker({
  value,
  onChange,
  today = new Date(),
}: {
  value: string;
  onChange: (value: string) => void;
  today?: Date;
}) {
  const [open, setOpen] = useState(false);
  const base = useMemo(() => {
    if (isIsoDate(value)) {
      const [y, m] = value.split("-").map(Number) as [number, number];
      return { year: y, month: m - 1 };
    }
    return { year: today.getFullYear(), month: today.getMonth() };
  }, [value, today]);
  const [cursor, setCursor] = useState(base);
  const gridRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setCursor(base);
  }, [open, base]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>('[data-day="active"]')?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, cursor]);

  const { year, month } = cursor;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());
  const activeDay = isIsoDate(value) && value.startsWith(iso(year, month, 1).slice(0, 7))
    ? Number(value.slice(8, 10))
    : null;
  const focusDay = activeDay ?? Math.min(Number(todayIso.slice(8, 10)), daysInMonth);

  const close = (restoreFocus = true) => {
    setOpen(false);
    // The focused day button unmounts with the popover, which would send focus
    // to <body>. Restore on the next frame, after React committed the close.
    if (restoreFocus) requestAnimationFrame(() => toggleRef.current?.focus());
  };


  const move = (day: number, delta: number) => {
    const next = new Date(Date.UTC(year, month, day + delta));
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
    onChange(iso(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate()));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, day: number) => {
    const step = (delta: number) => {
      event.preventDefault();
      move(day, delta);
    };
    switch (event.key) {
      case "ArrowRight":
        return step(1);
      case "ArrowLeft":
        return step(-1);
      case "ArrowDown":
        return step(7);
      case "ArrowUp":
        return step(-7);
      case "Home":
        return step(1 - day);
      case "End":
        return step(daysInMonth - day);
      case "PageUp":
        return step(-daysInMonth);
      case "PageDown":
        return step(daysInMonth - day + 1);
      case "Escape":
        event.preventDefault();
        return close();
      default:
        return undefined;
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-meta text-on-surface-variant/80">Tanggal jatuh tempo</span>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          type="date"
          value={value}
          aria-label="Tanggal jatuh tempo"
          data-testid="billing-due-date"
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-full rounded-2xl border border-outline-variant/30 bg-surface-container px-4 text-[14px] text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        />
        <button
          ref={toggleRef}
          type="button"
          aria-label="Buka kalender jatuh tempo"
          aria-expanded={open}
          data-testid="billing-due-date-toggle"
          onClick={() => setOpen((prev) => !prev)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-outline-variant/30 bg-surface-container text-on-surface-variant transition-colors hover:bg-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <Icon name="calendar_month" className="text-[20px]" />
        </button>
      </div>

      {open ? (
        <div
          data-testid="billing-due-date-popover"
          className="mt-1 rounded-2xl border border-outline-variant/20 bg-surface-container-high p-3 shadow-xl"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <div className="mb-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <button
              type="button"
              aria-label="Bulan sebelumnya"
              data-testid="billing-due-prev"
              onClick={() =>
                setCursor({ year: month === 0 ? year - 1 : year, month: (month + 11) % 12 })
              }
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Icon name="chevron_left" className="text-[18px]" />
            </button>
            <span
              data-testid="billing-due-label"
              className="truncate text-center text-label uppercase text-primary"
            >
              {monthLabel(year, month)}
            </span>
            <button
              type="button"
              aria-label="Bulan berikutnya"
              data-testid="billing-due-next"
              onClick={() =>
                setCursor({ year: month === 11 ? year + 1 : year, month: (month + 1) % 12 })
              }
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Icon name="chevron_right" className="text-[18px]" />
            </button>
          </div>

          <div
            ref={gridRef}
            role="grid"
            aria-label={`Pilih tanggal, ${monthLabel(year, month)}`}
            className="rounded-xl"
          >
            <div role="row" className="grid grid-cols-7">
              {WEEKDAYS.map((short, index) => (
                <abbr
                  key={WEEKDAY_LABEL[index]}
                  role="columnheader"
                  title={WEEKDAY_LABEL[index]}
                  className="py-1 text-center text-[10px] font-semibold uppercase text-on-surface-variant/70 no-underline"
                >
                  {short}
                </abbr>
              ))}
            </div>
            {rows.map((row, index) => (
              <div role="row" key={index} className="grid grid-cols-7">
                {row.map((day, cellIndex) =>
                  day === null ? (
                    <span role="gridcell" key={`empty-${cellIndex}`} className="h-10" />
                  ) : (
                    (() => {
                      const date = iso(year, month, day);
                      const selected = date === value;
                      return (
                        <span role="gridcell" key={date} aria-selected={selected}>
                          <button
                            type="button"
                            tabIndex={day === focusDay ? 0 : -1}
                            data-day={day === focusDay ? "active" : undefined}
                            data-testid={`billing-due-day-${date}`}
                            aria-label={formatDueDate(date)}
                            aria-pressed={selected}
                            onKeyDown={(event) => onKeyDown(event, day)}
                            onClick={() => {
                              onChange(date);
                              close();
                            }}
                            className={`flex h-10 w-full items-center justify-center rounded-xl text-[12px] tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-primary/60 ${
                              selected
                                ? "bg-primary font-bold text-on-primary"
                                : date === todayIso
                                  ? "bg-primary-container/40 text-primary"
                                  : "text-on-surface hover:bg-surface-variant"
                            }`}
                          >
                            {day}
                          </button>
                        </span>
                      );
                    })()
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
