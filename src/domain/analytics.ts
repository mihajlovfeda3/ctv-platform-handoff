export type AnalyticRow = {
  id: string;
  name: string;
  externalId: string;
  implementation: string;
  maturity: number | null;
  readiness: number | null;
  impact: number | null;
  directions: { id: string; name: string }[];
};
export type Analytics = {
  rows: AnalyticRow[];
  directions: { id: string; name: string }[];
  total: number;
  context: string;
};
export const statusColors: Record<string, string> = {
  yes: "#2274c5",
  no: "#ec963b",
  unknown: "#8495a5",
};
export const pointRadius = (impact: number | null) =>
  impact === null ? 3 : 2 + impact * 1.5;
export function radarGroups(rows: AnalyticRow[]) {
  const groups = new Map<
    string,
    { key: string; directionId: string; level: number; rows: AnalyticRow[] }
  >();
  for (const row of rows)
    if (row.maturity !== null)
      for (const direction of new Map(
        row.directions.map((d) => [d.id, d]),
      ).values()) {
        const key = `${direction.id}:${row.maturity}`;
        if (!groups.has(key))
          groups.set(key, {
            key,
            directionId: direction.id,
            level: row.maturity,
            rows: [],
          });
        groups.get(key)!.rows.push(row);
      }
  return [...groups.values()];
}
export function matrixCells(rows: AnalyticRow[]) {
  const cells = new Map<string, AnalyticRow[]>();
  for (const row of rows) {
    const key =
      row.maturity === null || row.readiness === null
        ? "unknown"
        : `${row.maturity}:${row.readiness}`;
    cells.set(key, [...(cells.get(key) ?? []), row]);
  }
  return cells;
}
export function pointPosition(
  id: string,
  sector: number,
  sectors: number,
  level: number,
) {
  const n = parseInt(id.replaceAll("-", "").slice(-8), 16) >>> 0;
  const angle =
    ((sector + 0.15 + ((n % 1000) / 1000) * 0.7) * Math.PI * 2) / sectors -
    Math.PI / 2;
  // Stable jitter stays strictly inside the true maturity ring, never changes the score.
  const radius = (level - 0.8 + (((n >>> 10) % 1000) / 1000) * 0.6) * 44;
  return {
    x: 340 + Math.cos(angle) * radius,
    y: 290 + Math.sin(angle) * radius,
  };
}
