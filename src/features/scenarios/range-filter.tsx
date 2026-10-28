"use client";
export function RangeFilter({
  disabled,
  label,
  prefix,
  max,
  low,
  high,
  onChange,
  onCommit,
}: {
  disabled: boolean;
  label: string;
  prefix: string;
  max: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  onCommit: () => void;
}) {
  return (
    <fieldset className="range-filter" disabled={disabled}>
      <legend>{label}</legend>
      <output>
        {low} — {high}
      </output>
      <div
        className="range-track"
        style={{
          background: `linear-gradient(to right,#dbe4ed ${((low - 1) / (max - 1)) * 100}%,#2274c5 ${((low - 1) / (max - 1)) * 100}%,#2274c5 ${((high - 1) / (max - 1)) * 100}%,#dbe4ed ${((high - 1) / (max - 1)) * 100}%)`,
        }}
      >
        {["Min", "Max"].map((bound, i) => (
          <input
            key={bound}
            name={prefix + bound}
            type="range"
            min={1}
            max={max}
            step={1}
            value={i ? high : low}
            aria-label={`${label}: ${i ? "верхняя" : "нижняя"} граница`}
            style={{ zIndex: i === 0 && low === max ? 4 : i + 2 }}
            onChange={(e) => {
              e.stopPropagation();
              const n = Number(e.target.value);
              onChange(
                i ? low : Math.min(n, high),
                i ? Math.max(n, low) : high,
              );
            }}
            onPointerUp={onCommit}
            onKeyUp={onCommit}
            onBlur={onCommit}
          />
        ))}
      </div>
      <span className="range-ends">
        1 <span>{max}</span>
      </span>
    </fieldset>
  );
}
