import { it, expect } from "vitest";
import {
  matrixCells,
  radarGroups,
  pointPosition,
  pointRadius,
  statusColors,
  type AnalyticRow,
} from "../src/domain/analytics";
const row: AnalyticRow = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Synthetic",
  externalId: "SYN",
  implementation: "yes",
  maturity: 3,
  readiness: 4,
  impact: 2,
  directions: [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "a", name: "A" },
  ],
};
it("duplicates only across distinct sectors; matrix counts unique scenarios once", () => {
  const g = radarGroups([row]);
  expect(g).toHaveLength(2);
  expect(g.every((g) => g.rows.length === 1)).toBe(true);
  expect(matrixCells([row]).get("3:4")).toHaveLength(1);
});
it("unknown scores remain outside numeric coordinates", () => {
  const unknown = { ...row, maturity: null };
  expect(radarGroups([unknown])).toHaveLength(0);
  expect(matrixCells([unknown]).get("unknown")).toHaveLength(1);
});
it("deterministic jitter stays inside the actual maturity ring", () => {
  for (let level = 1; level <= 5; level++) {
    const p = pointPosition(row.id, 0, 8, level);
    expect(p).toEqual(pointPosition(row.id, 0, 8, level));
    const r = Math.hypot(p.x - 340, p.y - 290);
    expect(r).toBeGreaterThan((level - 1) * 44);
    expect(r).toBeLessThan(level * 44);
  }
});
it("encodes status independently from influence; unknown is distinct", () => {
  expect(new Set(Object.values(statusColors)).size).toBe(3);
  expect(pointRadius(3)).toBeGreaterThan(pointRadius(2));
  expect(pointRadius(2)).toBeGreaterThan(pointRadius(1));
  expect(pointRadius(null)).not.toBe(pointRadius(1));
});
