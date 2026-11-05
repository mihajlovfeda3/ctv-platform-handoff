"use client";
import {
  statusColors,
  type Analytics,
  type matrixCells,
} from "@/domain/analytics";
import { MatrixScatter } from "./matrix-scatter";
import { MatrixCells } from "./matrix-cells";
import { MatrixTooltip } from "./matrix-tooltip";
import { MatrixInfo } from "./matrix-info";
import type { WorkspaceQuery } from "./filter-state";
export function MatrixView({
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
  const mode = query.matrixMode ?? "points",
    unknown = cells.get("unknown")?.length ?? 0;
  const selected = data.rows.find((row) => row.id === query.selected);
  return (
    <>
      <div className="matrix-workspace" data-testid="matrix-workspace">
        <div key={mode} className="matrix-mode-layer" data-mode={mode}>
          {mode === "cells" ? (
            <MatrixCells cells={cells} query={query} navigate={navigate} />
          ) : (
            <MatrixScatter
              data={data}
              cells={cells}
              query={query}
              navigate={navigate}
            />
          )}
          <MatrixTooltip />
        </div>
      </div>
      <div className="matrix-summary-bar">
        <div className="analytics-legend" aria-label="Статус реализации">
          <span>
            <i style={{ background: statusColors.yes }} />
            Реализуется
          </span>
          <span>
            <i style={{ background: statusColors.no }} />
            Не реализуется
          </span>
        </div>
        <div className="matrix-summary-actions">
          {query.selected &&
            (!selected ||
              selected.maturity === null ||
              selected.readiness === null) && (
              <span className="analytics-selection-note" role="status">
                Выбранный сценарий не отображается в матрице
              </span>
            )}
          <span className="matrix-total" data-total={data.total}>
            {data.total} сценариев
          </span>
          <button
            className="unknown-button"
            onClick={() => navigate({ cell: "unknown", selected: undefined })}
          >
            Без РЗ или ОГ: {unknown}
          </button>
          <MatrixInfo />
        </div>
      </div>
    </>
  );
}
