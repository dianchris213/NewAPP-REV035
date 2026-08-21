export function Icon({
  name,
  className = "",
  fill = 0,
}: {
  name: string;
  className?: string;
  fill?: 0 | 1;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ fontVariationSettings: `"FILL" ${fill}` }}
    >
      {name}
    </span>
  );
}
