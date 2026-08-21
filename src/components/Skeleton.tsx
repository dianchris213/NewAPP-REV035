/** Neutral shimmer placeholder used while persisted data is hydrating. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-full bg-outline-variant/25 ${className}`}
    />
  );
}

/** Rows of pocket / fund-source placeholders with the same rhythm as real rows. */
export function ListSkeleton({
  rows = 3,
  label,
  testId,
}: {
  rows?: number;
  label: string;
  testId?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      {...(testId ? { "data-testid": testId } : {})}
      className="flex flex-col gap-3 py-2"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-1/2 rounded-md" />
            <Skeleton className="h-2.5 w-1/3 rounded-md" />
          </div>
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
