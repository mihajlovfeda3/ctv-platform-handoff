import { expect, it } from "vitest";
import {
  matrixBoundaries,
  matrixCellColor,
  matrixDensityScale,
  matrixGeometry,
  matrixZones,
} from "../src/domain/matrix-layout";
import { matrixPosition } from "../src/domain/camera";
import { matrixCells, pointRadius } from "../src/domain/analytics";
import { stableId } from "../src/lib/identity";
import { workspaceQuery } from "../src/features/scenarios/filter-state";
import { scenarioQuery } from "../src/domain/scenario";

it("retains the original strategic boundaries and all four names/strategies", () => {
  expect(matrixBoundaries).toEqual({ readiness: 3.5, maturity: 3.5 });
  expect(matrixZones.map((z) => [z.title, z.strategy])).toEqual([
    ["Венчур", "пробовать"],
    ["Мейнстрим", "внедрять"],
    ["Космос", "наблюдать"],
    ["Уникальные компетенции", "монетизировать"],
  ]);
});

it("uses stable bounded jitter and keeps scenario coordinates within the correct score cell", () => {
  for (const width of [500, 1100, 1650]) {
    const plot = matrixGeometry({ width, height: 603 });
    for (let i = 0; i < 2500; i++) {
      const maturity = (i % 5) + 1,
        readiness = (i % 7) + 1,
        id = stableId(`matrix:${i}`);
      const position = matrixPosition(id, maturity, readiness);
      expect(position).toEqual(matrixPosition(id, maturity, readiness));
      const x = plot.x(position.x),
        y = plot.y(position.y);
      expect(Math.round((x - plot.left) / plot.xStep + 0.5)).toBe(readiness);
      expect(Math.round((plot.bottom - y) / plot.yStep + 0.5)).toBe(maturity);
      expect(y - pointRadius(3)).toBeGreaterThan(44); // reserved upper annotations
      expect(y + pointRadius(3)).toBeLessThan(plot.bottom + 30); // lower annotations
      expect(x).toBeGreaterThan(plot.left);
      expect(x).toBeLessThan(plot.right);
    }
  }
});

it("scales impact sizes together in dense selections and keeps zero cells neutral", () => {
  const dense = matrixDensityScale(100, 10000);
  expect(dense).toBeLessThan(matrixDensityScale(3, 10000));
  expect(dense).toBeGreaterThanOrEqual(0.4);
  expect((pointRadius(3) * dense) / (pointRadius(1) * dense)).toBeCloseTo(
    pointRadius(3) / pointRadius(1),
  );
  expect(matrixCellColor(0, 100)).toBe("#f8fafc");
  expect(matrixCellColor(1, 100)).not.toBe(matrixCellColor(100, 100));
});

it("keeps the matrix presentation in workspace URLs without changing API parameters", () => {
  expect(workspaceQuery({ matrixMode: "cells" })?.query.matrixMode).toBe(
    "cells",
  );
  expect(workspaceQuery({})?.query.matrixMode).toBeUndefined();
  expect(
    workspaceQuery({ matrixMode: "invalid" })?.query.matrixMode,
  ).toBeUndefined();
  expect(scenarioQuery.parse({ matrixMode: "cells" })).not.toHaveProperty(
    "matrixMode",
  );
  expect(
    workspaceQuery({
      matrixMode: "cells",
      readinessMin: "7",
      readinessMax: "4",
    })?.query.matrixMode,
  ).toBe("cells");
});

it("counts scenarios once, even when they have multiple directions, and separates missing scores", () => {
  const rows = [1, 2, 3].map((n) => ({
    id: String(n),
    name: "Synthetic",
    externalId: `SYN-${n}`,
    implementation: "yes",
    impact: 2,
    maturity: n === 3 ? null : 4,
    readiness: 5,
    directions: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ],
  }));
  const cells = matrixCells(rows);
  expect(cells.get("4:5")).toHaveLength(2);
  expect(cells.get("unknown")).toHaveLength(1);
  expect([...cells.values()].flat()).toHaveLength(3);
});
