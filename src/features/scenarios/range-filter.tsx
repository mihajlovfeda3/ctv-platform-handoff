"use client";
import { Fragment } from "react";
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
      <div className="range-track">
        <span
          className="range-selection"
          aria-hidden="true"
          style={{
            left: `${((low - 1) / (max - 1)) * 100}%`,
            right: `${((max - high) / (max - 1)) * 100}%`,
          }}
        />
        {["Min", "Max"].map((bound, i) => (
          <Fragment key={bound}>
            <input
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
            <span
              className="range-handle"
              aria-hidden="true"
              style={{ left: `${(((i ? high : low) - 1) / (max - 1)) * 100}%` }}
            />
          </Fragment>
        ))}
      </div>
      <span className="range-ends">
        1 <span>{max}</span>
      </span>
    </fieldset>
  );
}
