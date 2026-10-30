"use client";
import { matrixCellColor } from "@/domain/matrix-layout";
import { type matrixCells, type AnalyticRow } from "@/domain/analytics";
import type { WorkspaceQuery } from "./filter-state";

export function MatrixCells({
  cells,
  query,
  navigate,
}: {
  cells: ReturnType<typeof matrixCells>;
  query: WorkspaceQuery;
  navigate: (patch: Record<string, string | undefined>) => void;
}) {
  const max = Math.max(
    1,
    ...[...cells.entries()]
      .filter(([key]) => key !== "unknown")
      .map(([, rows]) => rows.length),
  );
  const tooltip = (maturity: number, readiness: number, rows: AnalyticRow[]) =>
    `РЗ ${maturity}/5 · ОГ ${readiness}/7\nСценариев: ${rows.length}\nРеализуется: ${rows.filter((r) => r.implementation === "yes").length}\nНе реализуется: ${rows.filter((r) => r.implementation === "no").length}\nСтатус неизвестен: ${rows.filter((r) => r.implementation === "unknown").length}`;
  return (
    <div className="matrix-cells-layout">
      <div className="matrix-cell-x-title">Организационная готовность (ОГ)</div>
      <div className="matrix-cell-y-title">Рыночная зрелость (РЗ)</div>
      <div className="matrix-scroll">
        <table className="maturity-matrix">
          <caption className="sr-only">
            Сценарии по сочетаниям рыночной зрелости и организационной
            готовности
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">РЗ / ОГ</span>
              </th>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <th scope="col" key={n}>
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[5, 4, 3, 2, 1].map((level) => (
              <tr key={level}>
                <th scope="row">{level}</th>
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
                        data-cell={key}
                        data-count={rows.length}
                        data-empty={rows.length === 0 || undefined}
                        data-matrix-tip={tooltip(level, ready, rows)}
                        style={{
                          background: matrixCellColor(rows.length, max),
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
    </div>
  );
}
