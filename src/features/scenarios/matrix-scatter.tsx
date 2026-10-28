"use client";
import { matrixPosition } from "@/domain/camera";
import {
  matrixCells,
  pointRadius,
  statusColors,
  type Analytics,
} from "@/domain/analytics";
import type { ScenarioQuery } from "@/domain/scenario";
export function MatrixScatter({
  data,
  query,
  navigate,
}: {
  data: Analytics;
  query: ScenarioQuery;
  navigate: (patch: Record<string, string | undefined>) => void;
}) {
  const cells = matrixCells(data.rows);
  return (
    <svg
      className="matrix-scatter"
      viewBox="0 0 900 620"
      aria-label="Точечная матрица зрелости"
    >
      <defs>
        <marker
          id="axis-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="4"
          orient="auto"
        >
          <path d="M0 0 L7 4 L0 8" fill="none" stroke="#66798b" />
        </marker>
      </defs>
      <path
        d="M65 570 H865 M65 570 V35"
        stroke="#66798b"
        fill="none"
        markerEnd="url(#axis-arrow)"
      />
      <path d="M65 570 H865" stroke="#66798b" markerEnd="url(#axis-arrow)" />
      <text x={450} y={610} textAnchor="middle">
        Организационная готовность
      </text>
      <text transform="translate(20 300) rotate(-90)" textAnchor="middle">
        Рыночная зрелость
      </text>
      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
        <g key={n}>
          <path d={`M${80 + n * 100} 570 v5`} stroke="#66798b" />
          <text x={80 + n * 100} y={593} textAnchor="middle">
            {n}
          </text>
        </g>
      ))}
      {[1, 2, 3, 4, 5].map((n) => (
        <g key={n}>
          <path d={`M60 ${570 - n * 95} h5`} stroke="#66798b" />
          <text x={49} y={574 - n * 95} textAnchor="end">
            {n}
          </text>
        </g>
      ))}
      <path
        data-testid="zone-boundaries"
        d="M430 40 V570 M65 237.5 H855"
        stroke="#89929b"
        strokeWidth="2"
        strokeDasharray="6 6"
      />
      {[
        [120, 140, "Венчур", "пробовать"],
        [590, 140, "Мейнстрим", "внедрять"],
        [120, 532, "Космос", "наблюдать"],
        [590, 532, "Уникальные компетенции", "монетизировать"],
      ].map(([x, y, title, strategy]) => (
        <g className="matrix-zone" key={title}>
          <text x={x} y={y}>{`«${title}»`}</text>
          <text x={x} y={Number(y) + 15}>
            Стратегия: {strategy}
          </text>
        </g>
      ))}
      {[1, 2, 3, 4, 5].flatMap((maturity) =>
        [1, 2, 3, 4, 5, 6, 7].map((readiness) => {
          const key = `${maturity}:${readiness}`,
            count = cells.get(key)?.length ?? 0;
          return (
            <g
              key={key}
              role="button"
              tabIndex={0}
              aria-label={`РЗ ${maturity}, ОГ ${readiness}: ${count}`}
              className="scatter-cell"
              onClick={() => navigate({ cell: key, selected: undefined })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate({ cell: key, selected: undefined });
                }
              }}
            >
              <rect
                x={80 + readiness * 100 - 44}
                y={570 - maturity * 95 - 41}
                width={88}
                height={82}
                fill="transparent"
                stroke={query.cell === key ? "#ec963b" : "transparent"}
              />
              <text
                x={80 + readiness * 100 + 38}
                y={570 - maturity * 95 - 32}
                textAnchor="end"
                className="cell-count"
              >
                {count}
              </text>
              <title>{count} сценариев — открыть состав</title>
            </g>
          );
        }),
      )}
      {data.rows
        .filter((r) => r.maturity !== null && r.readiness !== null)
        .map((row) => {
          const p = matrixPosition(row.id, row.maturity!, row.readiness!);
          return (
            <circle
              key={row.id}
              role="button"
              tabIndex={0}
              className="matrix-point"
              data-scenario={row.id}
              data-maturity={row.maturity}
              data-readiness={row.readiness}
              cx={80 + p.x * 100}
              cy={570 - p.y * 95}
              r={pointRadius(row.impact)}
              fill={statusColors[row.implementation]}
              fillOpacity={0.72}
              stroke={
                query.selected === row.id
                  ? "#142a48"
                  : row.impact === null
                    ? "#566675"
                    : "white"
              }
              strokeWidth={query.selected === row.id ? 2.5 : 0.5}
              strokeDasharray={row.impact === null ? "2 1" : undefined}
              aria-label={`${row.externalId}: ${row.name}`}
              onClick={() => navigate({ selected: row.id })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate({ selected: row.id });
                }
              }}
            >
              <title>{`${row.externalId} · РЗ ${row.maturity} · ОГ ${row.readiness} · ${row.name}`}</title>
            </circle>
          );
        })}
    </svg>
  );
}
