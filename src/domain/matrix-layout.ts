import { pointRadius } from "./analytics";
import type { Viewport } from "./camera";

// Existing ЦТВ boundaries: between ОГ 3/4 and РЗ 3/4. They do not depend on data.
export const matrixBoundaries = { readiness: 3.5, maturity: 3.5 } as const;
export const matrixZones = [
  { title: "Венчур", strategy: "пробовать", side: "left", edge: "top" },
  { title: "Мейнстрим", strategy: "внедрять", side: "right", edge: "top" },
  { title: "Космос", strategy: "наблюдать", side: "left", edge: "bottom" },
  {
    title: "Уникальные компетенции",
    strategy: "монетизировать",
    side: "right",
    edge: "bottom",
  },
] as const;

export function matrixGeometry(viewport: Viewport) {
  const left = viewport.width < 650 ? 46 : 64;
  const right = viewport.width - 22,
    top = 70,
    bottom = viewport.height - 108;
  const xStep = (right - left) / 7,
    yStep = (bottom - top) / 5;
  return {
    left,
    right,
    top,
    bottom,
    xStep,
    yStep,
    x: (readiness: number) => left + (readiness - 0.5) * xStep,
    y: (maturity: number) => bottom - (maturity - 0.5) * yStep,
  };
}

// One common density factor keeps impact sizes comparable across all cells.
// Every scenario remains present; dense selections also have the cell view.
export function matrixDensityScale(maxCellCount: number, cellArea: number) {
  return Math.max(
    0.4,
    Math.min(
      1,
      Math.sqrt(
        (cellArea * 0.28) /
          (Math.max(1, maxCellCount) * Math.PI * pointRadius(3) ** 2),
      ),
    ),
  );
}

export function matrixCellColor(count: number, max: number) {
  return count
    ? `rgba(34,116,197,${0.045 + Math.sqrt(count / Math.max(1, max)) * 0.24})`
    : "#f8fafc";
}
