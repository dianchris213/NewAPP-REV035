import { Icon } from "./Icon";

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="surface-panel flex flex-col items-center justify-center gap-2 rounded-[18px] px-5 py-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-variant/60 text-primary/70">
        <Icon name={icon} className="text-[22px]" />
      </span>
      <p className="text-section text-on-surface">{title}</p>
      {description ? (
        <p className="max-w-[240px] text-meta text-on-surface-variant/80">{description}</p>
      ) : null}
    </div>
  );
}
