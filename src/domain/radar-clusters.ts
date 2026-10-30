import {
  pointPosition,
  pointRadius,
  radarGroups,
  type Analytics,
  type AnalyticRow,
} from "./analytics";

export type RadarNode = {
  key: string;
  directionId: string;
  level: number;
  x: number;
  y: number;
  span: number;
  rows: AnalyticRow[];
  children: RadarNode[];
  statuses: Record<string, number>;
};

// Independent trees preserve the analytical boundaries of direction and РЗ.
// Stable paths also keep an open group's membership independent of the camera.
export function buildRadarHierarchy(data: Analytics) {
  const nodes = new Map<string, RadarNode>();
  const roots = radarGroups(data.rows).map((group) => {
    const sector = data.directions.findIndex((d) => d.id === group.directionId);
    const points = group.rows
      .map((row) => ({
        row,
        ...pointPosition(row.id, sector, data.directions.length, group.level),
      }))
      .sort((a, b) => a.row.id.localeCompare(b.row.id));
    const build = (
      items: typeof points,
      key: string,
      left: number,
      top: number,
      size: number,
      depth: number,
    ): RadarNode => {
      const xs = items.map((p) => p.x),
        ys = items.map((p) => p.y);
      const node: RadarNode = {
        key,
        directionId: group.directionId,
        level: group.level,
        x: xs.reduce((sum, x) => sum + x, 0) / items.length,
        y: ys.reduce((sum, y) => sum + y, 0) / items.length,
        span: Math.max(
          Math.max(...xs) - Math.min(...xs),
          Math.max(...ys) - Math.min(...ys),
        ),
        rows: items.map((p) => p.row),
        children: [],
        statuses: {},
      };
      for (const p of items)
        node.statuses[p.row.implementation] =
          (node.statuses[p.row.implementation] ?? 0) + 1;
      nodes.set(key, node);
      if (items.length > 1 && depth < 12 && node.span > 0.0001) {
        const half = size / 2;
        const buckets = Array.from({ length: 4 }, () => [] as typeof points);
        for (const p of items)
          buckets[
            (p.x >= left + half ? 1 : 0) + (p.y >= top + half ? 2 : 0)
          ].push(p);
        node.children = buckets.flatMap((bucket, i) =>
          bucket.length
            ? [
                build(
                  bucket,
                  `${key}/${i}`,
                  left + (i % 2) * half,
                  top + Math.floor(i / 2) * half,
                  half,
                  depth + 1,
                ),
              ]
            : [],
        );
      }
      return node;
    };
    return build(points, group.key, 120, 70, 440, 0);
  });
  return { roots, nodes };
}

export function visibleRadarClusters(roots: RadarNode[], scale: number) {
  const result: RadarNode[] = [];
  const visit = (node: RadarNode) => {
    if (!node.children.length || node.span * scale <= 58) result.push(node);
    else node.children.forEach(visit);
  };
  roots.forEach(visit);
  return result;
}

// Glyph dimensions are screen dimensions, independent of the transformed layer.
export function radarPointScreenRadius(
  impact: number | null,
  baseScale: number,
  zoom: number,
) {
  return pointRadius(impact) * Math.min(baseScale, 1.35) * Math.pow(zoom, 0.1);
}

export function groupRadius(count: number) {
  return count >= 1000 ? 18 : count >= 100 ? 16 : 14;
}

// A deterministic spatial hash separates count glyphs without moving scenario
// coordinates. A short leader preserves the aggregate's true centroid.
export function packRadarGroups(nodes: RadarNode[], scale: number) {
  const grid = new Map<string, { x: number; y: number; r: number }[]>();
  const cell = 40;
  const key = (x: number, y: number) => `${x}:${y}`;
  return [...nodes]
    .sort((a, b) => b.rows.length - a.rows.length || a.key.localeCompare(b.key))
    .map((node) => {
      const original = { x: (node.x - 340) * scale, y: (node.y - 290) * scale };
      if (node.rows.length === 1) return { node, ...original, dx: 0, dy: 0 };
      const r = groupRadius(node.rows.length);
      let p = original;
      for (let attempt = 0; ; attempt++) {
        const distance = attempt ? 8 * Math.sqrt(attempt) : 0;
        p = {
          x: original.x + Math.cos(attempt * 2.399963) * distance,
          y: original.y + Math.sin(attempt * 2.399963) * distance,
        };
        const gx = Math.floor(p.x / cell),
          gy = Math.floor(p.y / cell);
        let collision = false;
        for (let x = gx - 1; x <= gx + 1; x++)
          for (let y = gy - 1; y <= gy + 1; y++)
            if (
              grid
                .get(key(x, y))
                ?.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < q.r + r + 3)
            )
              collision = true;
        if (!collision) {
          const bucket = grid.get(key(gx, gy)) ?? [];
          bucket.push({ ...p, r });
          grid.set(key(gx, gy), bucket);
          break;
        }
      }
      return {
        node,
        ...p,
        dx: (p.x - original.x) / scale,
        dy: (p.y - original.y) / scale,
      };
    });
}
