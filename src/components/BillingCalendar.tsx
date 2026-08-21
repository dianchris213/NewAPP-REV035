import { useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { formatIDR } from "@/lib/app-store";
import {
  billStatus,
  computeTotals,
  formatDueDate,
  RECURRING_LABEL,
  STATUS_LABEL,
  type Bill,
} from "@/lib/billing";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const DOT_TONE: Record<string, string> = {
  paid: "bg-primary",
  overdue: "bg-error",
  "due-soon": "bg-tertiary",
  upcoming: "bg-on-surface-variant/60",
};

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
 * Month calendar of every bill's due date. Keyboard navigation follows the
 * WAI-ARIA grid pattern: one tab stop, arrows/Home/End/PageUp/PageDown move the
 * focused day, and the selected day's bills are announced below the grid.
 */
export function BillingCalendar({ bills, today = new Date() }: { bills: Bill[]; today?: Date }) {
  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());
  const [cursor, setCursor] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }));
  const [selected, setSelected] = useState(todayIso);
  const gridRef = useRef<HTMLDivElement>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, Bill[]>();
    for (const bill of bills) {
      const list = map.get(bill.dueDate);
      if (list) list.push(bill);
      else map.set(bill.dueDate, [bill]);
    }
    return map;
  }, [bills]);

  const { year, month } = cursor;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // Monday-first offset.
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, r) => cells.slice(r * 7, r * 7 + 7));

  const focusDay = (day: number, y = year, m = month) => {
    const clamped = Math.min(day, new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
    setCursor({ year: y, month: m });
    setSelected(iso(y, m, clamped));
    requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLButtonElement>('[data-day="selected"]')?.focus();
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, day: number) => {
    const shift = (delta: number) => {
      event.preventDefault();
      const next = new Date(Date.UTC(year, month, day + delta));
      focusDay(next.getUTCDate(), next.getUTCFullYear(), next.getUTCMonth());
    };
    switch (event.key) {
      case "ArrowRight":
        return shift(1);
      case "ArrowLeft":
        return shift(-1);
      case "ArrowDown":
        return shift(7);
      case "ArrowUp":
        return shift(-7);
      case "Home":
        event.preventDefault();
        return focusDay(1);
      case "End":
        event.preventDefault();
        return focusDay(daysInMonth);
      case "PageUp":
        event.preventDefault();
        return focusDay(day, month === 0 ? year - 1 : year, (month + 11) % 12);
      case "PageDown":
        event.preventDefault();
        return focusDay(day, month === 11 ? year + 1 : year, (month + 1) % 12);
      default:
        return undefined;
    }
  };

  const selectedBills = byDate.get(selected) ?? [];
  const selectedInMonth = selected.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`);

  return (
    <section className="mt-5" data-testid="billing-calendar">
      <div className="mb-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <button
          type="button"
          aria-label="Bulan sebelumnya"
          data-testid="billing-calendar-prev"
          onClick={() => setCursor({ year: month === 0 ? year - 1 : year, month: (month + 11) % 12 })}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <Icon name="chevron_left" className="text-[18px]" />
        </button>
        <h4
          className="m-0 truncate text-center text-label uppercase text-primary"
          data-testid="billing-calendar-label"
        >
          {monthLabel(year, month)}
        </h4>
        <button
          type="button"
          aria-label="Bulan berikutnya"
          data-testid="billing-calendar-next"
          onClick={() => setCursor({ year: month === 11 ? year + 1 : year, month: (month + 1) % 12 })}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <Icon name="chevron_right" className="text-[18px]" />
        </button>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label={`Kalender jatuh tempo ${monthLabel(year, month)}`}
        className="rounded-2xl bg-surface-container p-2"
      >
        <div role="row" className="grid grid-cols-7">
          {WEEKDAYS.map((day) => (
            <span
              key={day}
              role="columnheader"
              className="py-1 text-center text-[10px] font-semibold uppercase text-on-surface-variant/70"
            >
              {day}
            </span>
          ))}
        </div>
        {rows.map((row, index) => (
          <div role="row" key={index} className="grid grid-cols-7">
            {row.map((day, cellIndex) => {
              if (day === null) {
                return <span role="gridcell" key={`empty-${cellIndex}`} className="h-11" />;
              }
              const date = iso(year, month, day);
              const dayBills = byDate.get(date) ?? [];
              const isSelected = date === selected;
              const isToday = date === todayIso;
              const label = dayBills.length
                ? `${formatDueDate(date)}, ${dayBills.length} tagihan: ${dayBills
                    .map((b) => `${b.name} ${STATUS_LABEL[billStatus(b, today)]}`)
                    .join(", ")}`
                : `${formatDueDate(date)}, tidak ada tagihan`;
              return (
                <span role="gridcell" key={date} aria-selected={isSelected}>
                  <button
                    type="button"
                    tabIndex={isSelected || (!selectedInMonth && day === 1) ? 0 : -1}
                    data-day={isSelected ? "selected" : undefined}
                    data-testid={`billing-day-${date}`}
                    aria-label={label}
                    onKeyDown={(event) => onKeyDown(event, day)}
                    onClick={() => setSelected(date)}
                    className={`flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl text-[12px] transition-colors focus-visible:ring-2 focus-visible:ring-primary/60 ${
                      isSelected
                        ? "bg-primary text-on-primary"
                        : isToday
                          ? "bg-primary-container/40 text-primary"
                          : "text-on-surface"
                    }`}
                  >
                    <span className="tabular-nums">{day}</span>
                    <span aria-hidden="true" className="flex h-1.5 items-center gap-0.5">
                      {dayBills.slice(0, 3).map((bill) => (
                        <span
                          key={bill.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            isSelected ? "bg-on-primary" : DOT_TONE[billStatus(bill, today)]
                          }`}
                        />
                      ))}
                    </span>
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <div aria-live="polite" data-testid="billing-calendar-detail" className="mt-2">
        <p className="m-0 text-[11px] font-semibold uppercase text-on-surface-variant/70">
          {formatDueDate(selected)}
        </p>
        {selectedBills.length === 0 ? (
          <p className="m-0 mt-1 text-[12px] text-on-surface-variant">
            Tidak ada tagihan jatuh tempo.
          </p>
        ) : (
          <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
            {selectedBills.map((bill) => (
              <li
                key={bill.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-surface-container px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icon name={bill.icon} className="shrink-0 text-[16px] text-primary" />
                  <span className="truncate text-[12px] text-on-surface">{bill.name}</span>
                </span>
                <span className="shrink-0 text-right text-[11px] text-on-surface-variant">
                  {`${formatIDR(computeTotals(bill).total)} · ${
                    bill.recurring === "none" ? "Terjadwal" : `Berulang ${RECURRING_LABEL[bill.recurring]}`
                  } · ${STATUS_LABEL[billStatus(bill, today)]}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
