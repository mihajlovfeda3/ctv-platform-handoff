"use client";
import { memo, useMemo, type RefObject } from "react";
import {
  pointPosition,
  statusColors,
  type Analytics,
} from "@/domain/analytics";
import {
  groupRadius,
  packRadarGroups,
  radarPointScreenRadius,
  visibleRadarClusters,
  type buildRadarHierarchy,
} from "@/domain/radar-clusters";

// Node and the browser can differ in the last bits of trigonometric results.
// Serialize marker positions at the same subpixel precision on both sides.
const svgCoordinate = (value: number) => Number(value.toFixed(6));

export const RadarMarks = memo(function RadarMarks({
  data,
  hierarchy,
  baseScale,
  zoom,
  mode,
  selected,
  cluster,
  moved,
  navigate,
}: {
  data: Analytics;
  hierarchy: ReturnType<typeof buildRadarHierarchy>;
  baseScale: number;
  zoom: number;
  mode: string;
  selected?: string;
  cluster?: string;
  moved: RefObject<boolean>;
  navigate: (patch: Record<string, string | number | undefined>) => void;
}) {
  const scale = baseScale * zoom;
  // Discrete LOD prevents wheel frames from continuously repartitioning a group.
  const lod = Math.pow(Math.SQRT2, Math.floor(Math.log2(zoom) * 2));
  const groups = useMemo(
    () =>
      mode === "groups"
        ? packRadarGroups(
            visibleRadarClusters(hierarchy.roots, baseScale * lod),
            scale,
          )
        : [],
    [hierarchy, baseScale, lod, scale, mode],
  );
  const points = useMemo(
    () =>
      hierarchy.roots.flatMap((root) =>
        root.rows.map((row) => ({
          node: {
            ...root,
            rows: [row],
            ...pointPosition(
              row.id,
              data.directions.findIndex((d) => d.id === root.directionId),
              data.directions.length,
              root.level,
            ),
          },
          dx: 0,
          dy: 0,
        })),
      ),
    [data, hierarchy],
  );
  const entries = mode === "groups" ? groups : points;
  return (
    <g key={mode} className="radar-marker-layer" data-mode={mode}>
      {entries.map(({ node, dx, dy }) => {
        const row = node.rows[0],
          isGroup = node.rows.length > 1;
        const pick = () => {
          if (!moved.current)
            navigate(
              isGroup
                ? { cluster: node.key, selected: undefined }
                : { selected: row.id },
            );
        };
        const events = {
          onClick: pick,
          onKeyDown: (e: React.KeyboardEvent<SVGElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              pick();
            }
          },
        };
        if (!isGroup) {
          const r = radarPointScreenRadius(row.impact, baseScale, zoom) / scale;
          const cx = svgCoordinate(node.x),
            cy = svgCoordinate(node.y);
          return (
            <g key={`${node.key}:${row.id}`}>
              {selected === row.id && (
                <circle
                  className="radar-selection-halo"
                  cx={cx}
                  cy={cy}
                  r={r + 4 / scale}
                  fill="#2274c51a"
                  stroke="#2274c54d"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              )}
              <circle
                className="radar-mark radar-point"
                data-scenario={row.id}
                role="button"
                tabIndex={0}
                aria-label={`${row.externalId}: ${row.name}`}
                aria-pressed={selected === row.id}
                cx={cx}
                cy={cy}
                r={r}
                fill={statusColors[row.implementation]}
                fillOpacity={0.86}
                stroke={
                  selected === row.id
                    ? "#174d83"
                    : row.impact === null
                      ? "#667c90"
                      : "#fff"
                }
                strokeWidth={selected === row.id ? 1.6 : 0.9}
                vectorEffect="non-scaling-stroke"
                strokeDasharray={row.impact === null ? "2 2" : undefined}
                {...events}
              >
                <desc>{`${row.externalId} · ${row.name}\nРЗ ${row.maturity}; ОГ ${row.readiness ?? "неизвестно"}; влияние ${row.impact ?? "неизвестно"}`}</desc>
              </circle>
            </g>
          );
        }
        const r = groupRadius(node.rows.length),
          circumference = 2 * Math.PI * r;
        const active =
          cluster === node.key || node.rows.some((r) => r.id === selected);
        let offset = 0;
        const direction = data.directions.find(
          (d) => d.id === node.directionId,
        )?.name;
        return (
          <g
            key={node.key}
            className="radar-mark radar-group"
            data-cluster={node.key}
            data-count={node.rows.length}
            role="button"
            tabIndex={0}
            aria-pressed={active}
            aria-label={`Группа: ${direction}, РЗ ${node.level}, ${node.rows.length} сценариев`}
            {...events}
            transform={`translate(${svgCoordinate(node.x + dx)} ${svgCoordinate(node.y + dy)}) scale(${1 / scale})`}
          >
            <desc>{`${direction} · РЗ ${node.level}\n${node.rows.length} сценариев: реализуется ${node.statuses.yes ?? 0}, не реализуется ${node.statuses.no ?? 0}, неизвестно ${node.statuses.unknown ?? 0}\nНажмите, чтобы открыть состав группы`}</desc>
            {dx || dy ? (
              <line
                x1={svgCoordinate(-dx * scale)}
                y1={svgCoordinate(-dy * scale)}
                x2={0}
                y2={0}
                stroke="#87aac4"
                strokeWidth={0.7}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ) : null}
            {active && (
              <circle
                r={r + 4}
                fill="#2274c512"
                stroke="#2274c55c"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
            <circle
              className="radar-group-surface"
              r={r}
              fill="#f8fcff"
              stroke="#d4e2ed"
              strokeWidth={0.7}
              vectorEffect="non-scaling-stroke"
            />
            {Object.entries(statusColors).map(([status, color]) => {
              const length =
                ((node.statuses[status] ?? 0) / node.rows.length) *
                circumference;
              const segment = (
                <circle
                  key={status}
                  r={r}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.8}
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray={`${length} ${circumference}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90)"
                  pointerEvents="none"
                />
              );
              offset += length;
              return segment;
            })}
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={10.5}
              fontWeight={600}
              fill="#244b6f"
              pointerEvents="none"
            >
              {node.rows.length}
            </text>
          </g>
        );
      })}
    </g>
  );
});
