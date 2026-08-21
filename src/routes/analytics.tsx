import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, TopBar } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { formatIDR, useApp } from "@/lib/app-store";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analitik - Catatan Keuangan Mini App" },
      {
        name: "description",
        content: "Lihat tren pengeluaran, arus kas bersih, dan kategori teratas per periode.",
      },
      { property: "og:title", content: "Analitik - Catatan Keuangan Mini App" },
      {
        property: "og:description",
        content: "Tren pengeluaran dan ringkasan arus kas Anda.",
      },
    ],
  }),
  component: Analytics,
});

const ranges = [
  { key: "1D", label: "1H", days: 1, buckets: 6, bucketLabel: "Jam" },
  { key: "1W", label: "1M", days: 7, buckets: 7, bucketLabel: "Hari" },
  { key: "1M", label: "1B", days: 30, buckets: 6, bucketLabel: "Minggu" },
  { key: "1Y", label: "1T", days: 365, buckets: 12, bucketLabel: "Bulan" },
] as const;

function Analytics() {
  const { transactions } = useApp();
  const [rangeKey, setRangeKey] = useState<(typeof ranges)[number]["key"]>("1M");
  const range = ranges.find((r) => r.key === rangeKey)!;

  const data = useMemo(() => {
    const now = Date.now();
    const span = range.days * 86_400_000;
    const start = now - span;
    const prevStart = start - span;
    const inRange = transactions.filter((t) => new Date(t.date).getTime() >= start);
    const prev = transactions.filter((t) => {
      const ts = new Date(t.date).getTime();
      return ts >= prevStart && ts < start;
    });

    const sum = (list: typeof transactions, type: "income" | "expense") =>
      list.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);

    const expense = sum(inRange, "expense");
    const income = sum(inRange, "income");
    const prevExpense = sum(prev, "expense");
    const change = prevExpense ? ((expense - prevExpense) / prevExpense) * 100 : 0;

    const buckets = Array.from({ length: range.buckets }, () => 0);
    for (const t of inRange) {
      if (t.type !== "expense") continue;
      const ts = new Date(t.date).getTime();
      const idx = Math.min(range.buckets - 1, Math.floor(((ts - start) / span) * range.buckets));
      buckets[idx] = (buckets[idx] ?? 0) + t.amount;
    }

    const byCategory = new Map<string, number>();
    for (const t of inRange) {
      if (t.type !== "expense") continue;
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
    }
    const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { expense, income, change, buckets, categories, count: inRange.length };
  }, [transactions, range]);

  const max = Math.max(...data.buckets, 1);

  return (
    <AppShell topBar={<TopBar eyebrow="Ringkasan" title="Analitik" />}>
      <div className="mb-stack-md flex gap-2 swipe-x" role="tablist" aria-label="Rentang waktu">
        {ranges.map((r) => (
          <button
            key={r.key}
            role="tab"
            aria-selected={rangeKey === r.key}
            onClick={() => setRangeKey(r.key)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
              rangeKey === r.key
                ? "border-primary bg-primary-container/25 text-primary"
                : "border-outline-variant/30 text-on-surface-variant"
            }`}
          >
            {r.key}
          </button>
        ))}
      </div>

      <div className="gradient-hero rounded-[24px] p-[20px]">
        <span className="text-label uppercase text-primary/80">Total Pengeluaran</span>
        <p className="mt-1 text-display text-on-surface">{formatIDR(data.expense)}</p>
        <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-outline-variant/30 px-3 py-1 text-xs text-on-surface-variant">
          <Icon
            name={
              data.change > 0 ? "trending_up" : data.change < 0 ? "trending_down" : "trending_flat"
            }
            className="text-[16px]"
          />
          {Math.abs(Math.round(data.change))}% dibanding periode sebelumnya
        </span>
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-outline-variant/20 pt-4">
          <Stat label="Pemasukan" value={formatIDR(data.income)} className="text-success" />
          <Stat label="Pengeluaran" value={formatIDR(data.expense)} className="text-error" />
          <Stat
            label="Arus Kas"
            value={formatIDR(data.income - data.expense)}
            className="text-on-surface"
          />
        </div>
      </div>

      <section className="glass-card mt-stack-lg rounded-[24px] p-[16px]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-section text-on-surface">Tren Pengeluaran</h2>
          <span className="text-xs text-on-surface-variant">per {range.bucketLabel}</span>
        </div>
        {data.expense ? (
          <div
            className="flex h-40 items-end gap-2"
            role="img"
            aria-label="Grafik tren pengeluaran"
          >
            {data.buckets.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="gradient-primary w-full rounded-t-[8px] transition-all duration-500"
                  style={{ height: `${Math.max(4, (v / max) * 130)}px` }}
                />
                <span className="text-[9px] text-on-surface-variant/70">{i + 1}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="show_chart" title="Belum ada data tren" />
        )}
      </section>

      <section className="mt-stack-lg">
        <h2 className="mb-3 text-section text-on-surface">Kategori Teratas</h2>
        {data.categories.length ? (
          <div className="glass-card rounded-[16px] px-4">
            {data.categories.map(([name, value]) => (
              <div key={name} className="border-b border-outline-variant/20 py-3 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-body font-medium text-on-surface">{name}</span>
                  <span className="text-body font-semibold text-on-surface">
                    {formatIDR(value)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-variant">
                  <div
                    className="gradient-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${(value / (data.categories[0]?.[1] || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="donut_small"
            title="Tidak ada pengeluaran pada periode ini"
            description="Coba pilih rentang waktu lain."
          />
        )}
      </section>
    </AppShell>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label uppercase text-on-surface-variant">{label}</span>
      <span className={`text-sm font-semibold ${className}`}>{value}</span>
    </div>
  );
}
