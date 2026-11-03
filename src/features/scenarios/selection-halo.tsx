export function SelectionHalo({
  cx,
  cy,
  r,
}: {
  cx: number;
  cy: number;
  r: number;
}) {
  return (
    <circle
      data-selection-halo=""
      cx={cx}
      cy={cy}
      r={r}
      fill="#2274c51f"
      stroke="#174d83"
      strokeWidth={1.7}
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  );
}
