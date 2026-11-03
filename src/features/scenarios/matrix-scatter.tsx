"use client";
import { SelectionHalo } from "./selection-halo";
import { useLayoutEffect, useRef, useState } from "react";
import { matrixPosition } from "@/domain/camera";
import {
  pointRadius,
  statusColors,
  type Analytics,
  type matrixCells,
} from "@/domain/analytics";
import {
  matrixBoundaries,
  matrixDensityScale,
  matrixGeometry,
  matrixZones,
} from "@/domain/matrix-layout";
import { implementationLabels } from "@/domain/scenario";
import type { WorkspaceQuery } from "./filter-state";

export function MatrixScatter({
  data,
  cells,
  query,
  navigate,
}: {
  data: Analytics;
  cells: ReturnType<typeof matrixCells>;
  query: WorkspaceQuery;
  navigate: (patch: Record<string, string | undefined>) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [viewport, setViewport] = useState({ width: 1080, height: 620 });
  useLayoutEffect(() => {
    const node = svg.current!;
    const observer = new ResizeObserver(() => {
      const { width, height } = node.getBoundingClientRect();
      if (width > 0 && height > 0) setViewport({ width, height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const plot = matrixGeometry(viewport),
    splitX = plot.x(matrixBoundaries.readiness),
    splitY = plot.y(matrixBoundaries.maturity);
  const maxCount = Math.max(
    1,
    ...[...cells.entries()]
      .filter(([key]) => key !== "unknown")
      .map(([, rows]) => rows.length),
  );
  const density = matrixDensityScale(maxCount, plot.xStep * plot.yStep);
  const points = data.rows.filter(
    (row) => row.maturity !== null && row.readiness !== null,
  );
  const selected = points.find((row) => row.id === query.selected);
  const ordered = selected
    ? [...points.filter((row) => row !== selected), selected]
    : points;
  return (
    <svg
      ref={svg}
      className="matrix-scatter"
      viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      aria-label="Точечная матрица зрелости"
      data-plot-left={plot.left}
      data-plot-bottom={plot.bottom}
      data-x-step={plot.xStep}
      data-y-step={plot.yStep}
    >
      <desc>
        Ось X — организационная готовность 1–7; ось Y — рыночная зрелость 1–5.
        Цвет — статус, размер — влияние на бизнес-цели.
      </desc>
      <defs>
        <linearGradient id="matrix-material" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f9fcff" />
          <stop offset="1" stopColor="#f0f7fc" />
        </linearGradient>
      </defs>
      <rect
        x={plot.left}
        y={8}
        width={plot.right - plot.left}
        height={plot.bottom + 72}
        rx={7}
        fill="url(#matrix-material)"
      />
      {matrixZones.map((zone, i) => {
        const x = zone.side === "left" ? plot.left : splitX,
          right = zone.side === "left" ? splitX : plot.right;
        const y = zone.edge === "top" ? 8 : splitY,
          bottom = zone.edge === "top" ? splitY : plot.bottom + 80;
        return (
          <rect
            key={zone.title}
            className="matrix-zone-surface"
            data-zone={zone.title}
            x={x}
            y={y}
            width={right - x}
            height={bottom - y}
            fill={["#729dc20a", "#d8e9f50d", "#ffffff7d", "#91b5d415"][i]}
          />
        );
      })}
      <g className="matrix-grid" aria-hidden="true">
        {Array.from(
          { length: 8 },
          (_, n) =>
            n !== 3 && (
              <line
                key={`x${n}`}
                x1={plot.left + n * plot.xStep}
                x2={plot.left + n * plot.xStep}
                y1={plot.top}
                y2={plot.bottom}
              />
            ),
        )}
        {Array.from(
          { length: 6 },
          (_, n) =>
            n !== 2 && (
              <line
                key={`y${n}`}
                x1={plot.left}
                x2={plot.right}
                y1={plot.top + n * plot.yStep}
                y2={plot.top + n * plot.yStep}
              />
            ),
        )}
      </g>
      <path
        data-testid="zone-boundaries"
        data-readiness={matrixBoundaries.readiness}
        data-maturity={matrixBoundaries.maturity}
        d={`M${splitX} 12 V${plot.bottom + 76} M${plot.left} ${splitY} H${plot.right}`}
        className="matrix-boundaries"
      />
      <path
        d={`M${plot.left} ${plot.top} V${plot.bottom} H${plot.right}`}
        className="matrix-axis"
      />
      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
        <g key={`x${n}`} className="matrix-tick">
          <path d={`M${plot.x(n)} ${plot.bottom} v4`} />
          <text x={plot.x(n)} y={plot.bottom + 20} textAnchor="middle">
            {n}
          </text>
        </g>
      ))}
      {[1, 2, 3, 4, 5].map((n) => (
        <g key={`y${n}`} className="matrix-tick">
          <path d={`M${plot.left - 4} ${plot.y(n)} h4`} />
          <text x={plot.left - 12} y={plot.y(n) + 4} textAnchor="end">
            {n}
          </text>
        </g>
      ))}
      <text
        className="matrix-axis-title"
        x={(plot.left + plot.right) / 2}
        y={viewport.height - 10}
        textAnchor="middle"
      >
        Организационная готовность (ОГ)
      </text>
      <text
        className="matrix-axis-title"
        transform={`translate(17 ${(plot.top + plot.bottom) / 2}) rotate(-90)`}
        textAnchor="middle"
      >
        Рыночная зрелость (РЗ)
      </text>
      {matrixZones.map((zone) => {
        const x = zone.side === "left" ? plot.left + 14 : splitX + 14,
          y = zone.edge === "top" ? 27 : plot.bottom + 48;
        return (
          <g className="matrix-zone" key={zone.title}>
            <text x={x} y={y} className="matrix-zone-title">
              {zone.title}
            </text>
            <text x={x} y={y + 17} className="matrix-zone-strategy">
              Стратегия: {zone.strategy}
            </text>
          </g>
        );
      })}
      <g className="matrix-points-layer">
        {ordered.map((row) => {
          const p = matrixPosition(row.id, row.maturity!, row.readiness!);
          const x = plot.x(p.x),
            y = plot.y(p.y),
            r = pointRadius(row.impact) * density;
          const tip = `${row.name}\nРЗ ${row.maturity}/5 · ОГ ${row.readiness}/7 · влияние ${row.impact === null ? "неизвестно" : `${row.impact}/3`}\n${implementationLabels[row.implementation as keyof typeof implementationLabels]}`;
          const pick = () => navigate({ selected: row.id });
          return (
            <g key={row.id}>
              {query.selected === row.id && (
                <SelectionHalo cx={x} cy={y} r={r + 5} />
              )}
              <circle
                role="button"
                tabIndex={0}
                className="matrix-point"
                data-scenario={row.id}
                data-maturity={row.maturity}
                data-readiness={row.readiness}
                data-matrix-tip={tip}
                cx={x}
                cy={y}
                r={r}
                fill={statusColors[row.implementation]}
                fillOpacity={density < 0.8 ? 0.72 : 0.86}
                stroke={row.impact === null ? "#667c90" : "white"}
                strokeWidth={0.8}
                strokeDasharray={row.impact === null ? "2 2" : undefined}
                aria-label={`${row.externalId}: ${tip}`}
                aria-pressed={query.selected === row.id}
                onClick={pick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pick();
                  }
                }}
              >
                <desc>{tip}</desc>
              </circle>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
