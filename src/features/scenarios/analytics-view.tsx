"use client";
import { ContextLink as Link } from "./camera-context";
import { useRadarCamera } from "./use-radar-camera";
import { radarRadius } from "@/domain/camera";
import { RadarLabels } from "./radar-labels";
import { MatrixScatter } from "./matrix-scatter";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  matrixCells,
  radarGroups,
  pointPosition,
  pointRadius,
  statusColors,
  type Analytics,
} from "@/domain/analytics";
import { scenarioQuery, type ScenarioQuery } from "@/domain/scenario";
import { workspaceHref, type ScenarioView } from "./navigation";

export function AnalyticsView({
  data,
  query,
  view,
}: {
  data: Analytics;
  query: ScenarioQuery;
  view: ScenarioView;
}) {
  const router = useRouter();
  const navigate = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      // A delayed wheel commit must retain a selection/filter changed meanwhile.
      const latest = scenarioQuery.safeParse(
        Object.fromEntries(new URL(window.location.href).searchParams),
      );
      router.replace(
        workspaceHref(view, latest.success ? latest.data : query, patch),
        { scroll: false },
      );
    },
    [router, view, query],
  );
  const controls = useRadarCamera(view);
  const { camera, viewport, svg, moved } = controls;
  const [highlight, setHighlight] = useState<number | null>(null);
  const baseScale = radarRadius(viewport) / 220;
  const groups = useMemo(() => radarGroups(data.rows), [data.rows]);
  const cells = useMemo(() => matrixCells(data.rows), [data.rows]);
  const unknown = data.rows.filter(
    (r) => r.maturity === null || !r.directions.length,
  );
  const selectedGroup = groups.find((g) => g.key === query.cluster);
  const memberRows =
    view === "maturity"
      ? cells.get(query.cell ?? "")
      : query.cluster === "unknown"
        ? unknown
        : selectedGroup?.rows;
  const markers = useMemo(
    () =>
      groups.flatMap((group) => {
        const sector = data.directions.findIndex(
            (d) => d.id === group.directionId,
          ),
          n = data.directions.length;
        if (query.mode === "groups") {
          const angle = ((sector + 0.5) * Math.PI * 2) / n - Math.PI / 2,
            radius = (group.level === 1 ? 0.85 : group.level - 0.5) * 44;
          const nodeRadius = Math.max(
              5,
              Math.min(15, radius * Math.sin(Math.PI / n) - 3),
            ),
            circumference = 2 * Math.PI * nodeRadius;
          const yes = group.rows.filter(
              (r) => r.implementation === "yes",
            ).length,
            no = group.rows.filter((r) => r.implementation === "no").length;
          return [
            <g
              key={group.key}
              className="radar-mark"
              role="button"
              tabIndex={0}
              aria-label={`Группа: ${data.directions[sector]?.name}, РЗ ${group.level}, ${group.rows.length} сценариев`}
              onClick={() => {
                if (!moved.current)
                  navigate({ cluster: group.key, selected: undefined });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate({ cluster: group.key, selected: undefined });
                }
              }}
              transform={`translate(${340 + Math.cos(angle) * radius} ${290 + Math.sin(angle) * radius})`}
            >
              <circle
                r={nodeRadius + 4}
                pointerEvents="none"
                fill="none"
                stroke={
                  group.rows.some((r) => r.id === query.selected)
                    ? "#142a48"
                    : "transparent"
                }
                strokeWidth={2}
              />
              <title>{`РЗ ${group.level}: ${group.rows.length} уникальных сценариев`}</title>
              <circle
                r={nodeRadius}
                fill="white"
                stroke="#8495a5"
                strokeWidth={4}
              />
              <circle
                r={nodeRadius}
                fill="none"
                stroke={statusColors.yes}
                strokeWidth={4}
                strokeDasharray={`${(yes / group.rows.length) * circumference} ${circumference}`}
                transform="rotate(-90)"
              />
              <circle
                r={nodeRadius}
                fill="none"
                stroke={statusColors.no}
                strokeWidth={4}
                strokeDasharray={`${(no / group.rows.length) * circumference} ${circumference}`}
                strokeDashoffset={(-yes / group.rows.length) * circumference}
                transform="rotate(-90)"
              />
              <text textAnchor="middle" dy="4" fontSize="10" fill="#244e7e">
                {group.rows.length}
              </text>
            </g>,
          ];
        }
        return group.rows.map((row) => {
          const p = pointPosition(row.id, sector, n, group.level);
          return (
            <circle
              key={`${group.key}:${row.id}`}
              className="radar-mark"
              data-scenario={row.id}
              role="button"
              tabIndex={0}
              aria-label={`${row.externalId}: ${row.name}`}
              cx={p.x}
              cy={p.y}
              r={pointRadius(row.impact)}
              fill={statusColors[row.implementation]}
              fillOpacity={0.8}
              stroke={
                query.selected === row.id
                  ? "#142a48"
                  : row.impact === null
                    ? "#566675"
                    : "white"
              }
              strokeWidth={query.selected === row.id ? 2.5 : 0.5}
              strokeDasharray={row.impact === null ? "2 1" : undefined}
              onClick={() => {
                if (!moved.current) navigate({ selected: row.id });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate({ selected: row.id });
                }
              }}
            >
              <title>{`${row.externalId} · ${row.name}\nРЗ ${row.maturity}; ОГ ${row.readiness ?? "неизвестно"}; влияние ${row.impact ?? "неизвестно"}`}</title>
            </circle>
          );
        });
        // Only camera attributes change during gestures; marker elements are memoized.
      }),
    [data, groups, query.mode, query.selected, navigate, moved],
  );
  return (
    <>
      {view === "radar" ? (
        <>
          <div className="radar-viewport">
            <div className="radar-tools" aria-label="Масштаб радара">
              <div className="touch-zoom-controls">
                <button
                  onClick={() => controls.zoom(1.25)}
                  aria-label="Приблизить"
                >
                  +
                </button>
                <button
                  onClick={() => controls.zoom(0.8)}
                  aria-label="Отдалить"
                >
                  −
                </button>
              </div>
              <button onClick={() => controls.save({ z: 1, x: 0, y: 0 })}>
                Сброс масштаба
              </button>
            </div>
            <svg
              className="interactive-radar"
              ref={svg}
              viewBox={`0 0 ${viewport.width} ${viewport.height}`}
              aria-label="Интерактивный технологический радар"
              tabIndex={0}
              aria-describedby="radar-keyboard-help"
              onKeyDown={controls.onKeyDown}
              onPointerDown={controls.onPointerDown}
              onPointerMove={controls.onPointerMove}
              onPointerUp={controls.onPointerUp}
              onPointerCancel={controls.onPointerCancel}
            >
              <defs>
                <radialGradient id="radar-blue">
                  <stop stopColor="#bbe5f5" />
                  <stop offset="1" stopColor="#e9f7fc" />
                </radialGradient>
              </defs>
              <g>
                <g
                  data-testid="camera"
                  data-zoom={camera.z}
                  data-pan-x={camera.x}
                  data-pan-y={camera.y}
                  data-radius={radarRadius(viewport) * camera.z}
                  transform={`translate(${viewport.width / 2 + camera.x} ${viewport.height / 2 + camera.y}) scale(${baseScale * camera.z}) translate(-340 -290)`}
                >
                  <circle cx={340} cy={290} r={220} fill="url(#radar-blue)" />
                  {[1, 2, 3, 4, 5].map((level) => (
                    <g key={level}>
                      <circle
                        cx={340}
                        cy={290}
                        r={level * 44}
                        fill="none"
                        stroke="#c5deec"
                      />
                      <text
                        x={340 + level * 44 - 10}
                        y={286}
                        fontSize="10"
                        fill="#476982"
                      >
                        {level}
                      </text>
                    </g>
                  ))}
                  {data.directions.map((d, i) => {
                    const a =
                      (i * Math.PI * 2) / data.directions.length - Math.PI / 2;
                    return (
                      <g key={d.id}>
                        <path
                          className="radar-sector"
                          data-sector={i}
                          data-highlighted={highlight === i || undefined}
                          d={`M340 290 L${340 + Math.cos(a) * 220} ${290 + Math.sin(a) * 220} A220 220 0 0 1 ${340 + Math.cos(a + (Math.PI * 2) / data.directions.length) * 220} ${290 + Math.sin(a + (Math.PI * 2) / data.directions.length) * 220} Z`}
                          fill={highlight === i ? "#2274c525" : "transparent"}
                          onMouseEnter={() => setHighlight(i)}
                          onMouseLeave={() => setHighlight(null)}
                        />
                        <path
                          d={`M340 290 L${340 + Math.cos(a) * 220} ${290 + Math.sin(a) * 220}`}
                          stroke="white"
                        />
                      </g>
                    );
                  })}
                  {markers}
                </g>
              </g>
            </svg>
            <p id="radar-keyboard-help" className="sr-only">
              Масштаб: плюс и минус; 0 — сброс. Стрелки — перемещение радара. На
              сенсорном экране используйте кнопки приближения и отдаления.
            </p>
            <RadarLabels
              camera={camera}
              viewport={viewport}
              directions={data.directions}
              inspectorOpen={Boolean(query.selected || memberRows)}
              highlight={highlight}
              onHighlight={setHighlight}
            />
          </div>
          <div className="analytics-legend">
            <span style={{ color: statusColors.yes }}>● Реализуется</span>
            <span style={{ color: statusColors.no }}>● Не реализуется</span>
            <span style={{ color: statusColors.unknown }}>
              ● Статус неизвестен
            </span>
            <span>Размер: влияние 1–3 · пунктир: неизвестно</span>
          </div>
          <div className="radar-footer">
            <span className="radar-total">{data.total} сценариев</span>
            <details className="sample-details">
              <summary>О выборке</summary>
              <div>
                <p>Демонстрационные сценарии, оценки и связи синтетические.</p>
                <p>
                  Без ОГ: {data.rows.filter((r) => r.readiness === null).length}{" "}
                  · без влияния:{" "}
                  {data.rows.filter((r) => r.impact === null).length}
                </p>
                <p>
                  {groups.reduce((n, g) => n + g.rows.length, 0)} маркеров в
                  режиме точек. Сценарий с несколькими направлениями показан в
                  каждом соответствующем секторе.
                </p>
              </div>
            </details>
          </div>
          <button
            className="unknown-button"
            onClick={() =>
              navigate({ cluster: "unknown", selected: undefined })
            }
          >
            Без РЗ или направления: {unknown.length}
          </button>
        </>
      ) : (
        <>
          <MatrixScatter data={data} query={query} navigate={navigate} />
          <div className="analytics-legend">
            <span style={{ color: statusColors.yes }}>● Реализуется</span>
            <span style={{ color: statusColors.no }}>● Не реализуется</span>
            <span style={{ color: statusColors.unknown }}>
              ● Статус неизвестен
            </span>
            <span>Размер — влияние 1–3; пунктир — неизвестно</span>
            <span>Число в углу сочетания оценок — открыть состав</span>
          </div>
          <details className="aggregate-matrix">
            <summary>Агрегированный просмотр — количества по ячейкам</summary>
            <div className="matrix-scroll">
              <table className="maturity-matrix">
                <caption>
                  Рыночная зрелость (строки) × организационная готовность
                  (столбцы)
                </caption>
                <thead>
                  <tr>
                    <th>РЗ ↓ / ОГ →</th>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <th key={n}>{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[5, 4, 3, 2, 1].map((level) => (
                    <tr key={level}>
                      <th>{level}</th>
                      {[1, 2, 3, 4, 5, 6, 7].map((ready) => {
                        const key = `${level}:${ready}`,
                          rows = cells.get(key) ?? [];
                        return (
                          <td key={key}>
                            <button
                              aria-label={`РЗ ${level}, ОГ ${ready}: ${rows.length}`}
                              aria-pressed={
                                query.cell === key ||
                                rows.some((r) => r.id === query.selected)
                              }
                              style={{
                                background: `rgba(34,116,197,${Math.min(0.65, 0.04 + (rows.length / Math.max(1, data.total)) * 4)})`,
                              }}
                              onClick={() =>
                                navigate({ cell: key, selected: undefined })
                              }
                            >
                              {rows.length}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <button
            className="unknown-button"
            onClick={() => navigate({ cell: "unknown", selected: undefined })}
          >
            Без РЗ или ОГ: {cells.get("unknown")?.length ?? 0}
          </button>
          <span className="matrix-total">
            Всего уникальных сценариев: {data.total}
          </span>
        </>
      )}
      {!data.total && (
        <p className="analytics-empty">Нет сценариев по выбранным условиям</p>
      )}
      {memberRows && !query.selected && (
        <aside
          className="scenario-inspector group-inspector"
          aria-label="Состав выбранной группы"
        >
          <div className="inspector-top">
            <h3>
              {view === "maturity"
                ? `Ячейка ${query.cell}`
                : query.cluster === "unknown"
                  ? "Без координат"
                  : "Состав группы"}{" "}
              · {memberRows.length}
            </h3>
            <button
              aria-label="Закрыть группу"
              onClick={() => navigate({ cluster: undefined, cell: undefined })}
            >
              ×
            </button>
          </div>
          <div className="group-members">
            {memberRows.map((row) => (
              <Link
                key={row.id}
                scroll={false}
                replace
                href={workspaceHref(view, query, { selected: row.id })}
              >
                <strong>{row.externalId}</strong> {row.name}
              </Link>
            ))}
          </div>
        </aside>
      )}
    </>
  );
}
