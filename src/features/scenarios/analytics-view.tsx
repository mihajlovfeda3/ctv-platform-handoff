"use client";
import { ContextLink as Link } from "./camera-context";
import { useRadarCamera } from "./use-radar-camera";
import { radarRadius } from "@/domain/camera";
import { buildRadarHierarchy } from "@/domain/radar-clusters";
import { RadarTooltip } from "./radar-tooltip";
import { RadarMarks } from "./radar-marks";
import { RadarLabels } from "./radar-labels";
import { MatrixScatter } from "./matrix-scatter";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  matrixCells,
  radarGroups,
  statusColors,
  type Analytics,
} from "@/domain/analytics";
import { type ScenarioQuery } from "@/domain/scenario";
import { RadarInfo } from "./radar-info";
import { RotateCcw } from "lucide-react";
import { workspaceQuery } from "./filter-state";
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
      const latest = workspaceQuery(
        Object.fromEntries(new URL(window.location.href).searchParams),
      );
      router.replace(workspaceHref(view, latest?.query ?? query, patch), {
        scroll: false,
      });
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
  const hierarchy = useMemo(() => buildRadarHierarchy(data), [data]);
  const selectedGroup = hierarchy.nodes.get(query.cluster ?? "");
  const memberRows =
    view === "maturity"
      ? cells.get(query.cell ?? "")
      : query.cluster === "unknown"
        ? unknown
        : selectedGroup?.rows;
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
              {camera.z > 1.000001 && (
                <button
                  className="radar-reset"
                  aria-label="Сброс масштаба"
                  title="Сброс масштаба"
                  onClick={() => controls.save({ z: 1, x: 0, y: 0 })}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                </button>
              )}
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
                <radialGradient id="radar-blue" cx="44%" cy="40%" r="66%">
                  <stop stopColor="#b9dfef" />
                  <stop offset="0.48" stopColor="#d3edf7" />
                  <stop offset="1" stopColor="#eef8fc" />
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
                        stroke={level === 5 ? "#9bc4db" : "#b4d4e6"}
                        strokeWidth={level === 5 ? 1.1 : 0.75}
                        vectorEffect="non-scaling-stroke"
                      />
                      <text
                        x={340 + level * 44 - 10 / (baseScale * camera.z)}
                        y={290 - 5 / (baseScale * camera.z)}
                        fontSize={10 / (baseScale * camera.z)}
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
                          fill={
                            highlight === i
                              ? "#3b83bc12"
                              : i % 2
                                ? "#ffffff0a"
                                : "transparent"
                          }
                          onMouseEnter={() => setHighlight(i)}
                          onMouseLeave={() => setHighlight(null)}
                        />
                        <path
                          d={`M340 290 L${340 + Math.cos(a) * 220} ${290 + Math.sin(a) * 220}`}
                          stroke="#ffffffc4"
                          strokeWidth={0.9}
                          vectorEffect="non-scaling-stroke"
                        />
                      </g>
                    );
                  })}
                  <RadarMarks
                    data={data}
                    hierarchy={hierarchy}
                    baseScale={baseScale}
                    zoom={camera.z}
                    mode={query.mode}
                    selected={query.selected}
                    cluster={query.cluster}
                    moved={moved}
                    navigate={navigate}
                  />
                </g>
              </g>
            </svg>
            <p id="radar-keyboard-help" className="sr-only">
              Масштаб: плюс и минус; 0 — сброс. Стрелки — перемещение радара. На
              сенсорном экране используйте кнопки приближения и отдаления.
            </p>
            <RadarTooltip />
            <RadarLabels
              camera={camera}
              viewport={viewport}
              directions={data.directions}
              inspectorOpen={Boolean(query.selected || memberRows)}
              highlight={highlight}
              onHighlight={setHighlight}
            />
          </div>
          <div className="radar-summary-bar">
            <div className="analytics-legend" aria-label="Статус реализации">
              <span>
                <i style={{ background: statusColors.yes }} />
                Реализуется
              </span>
              <span>
                <i style={{ background: statusColors.no }} />
                Не реализуется
              </span>
              <span>
                <i style={{ background: statusColors.unknown }} />
                Статус неизвестен
              </span>
            </div>
            <div className="radar-summary-actions">
              <button
                className="unknown-button"
                onClick={() =>
                  navigate({ cluster: "unknown", selected: undefined })
                }
              >
                Без РЗ или направления: {unknown.length}
              </button>
              <RadarInfo
                data={data}
                markerCount={groups.reduce((n, g) => n + g.rows.length, 0)}
              />
            </div>
          </div>
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
          {view === "radar" && selectedGroup && camera.z < 8 && (
            <button
              className="group-zoom-button"
              onClick={() => {
                const z = Math.min(8, camera.z * 2);
                controls.save({
                  z,
                  x: -(selectedGroup.x - 340) * baseScale * z,
                  y: -(selectedGroup.y - 290) * baseScale * z,
                });
              }}
            >
              Приблизить группу
            </button>
          )}
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
