import { radarRadius, type Camera, type Viewport } from "./camera";

type Point = { x: number; y: number };
export type LabelBox = Point & { width: number; height: number };
export type SectorFootprint = {
  index: number;
  polygon: Point[];
  anchor: Point;
};
const tau = Math.PI * 2;
const bound = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

// Clip each convex circular sector to the actual viewport. Arc chords have
// <0.06px sagitta at our largest viewport/zoom, unlike coarse viewport sampling.
export function sectorFootprints(c: Camera, v: Viewport, count: number) {
  const result: SectorFootprint[] = [],
    r = radarRadius(v) * c.z,
    center = { x: v.width / 2 + c.x, y: v.height / 2 + c.y };
  for (let index = 0; index < count; index++) {
    const start = (index * tau) / count - Math.PI / 2;
    let polygon: Point[] = [center];
    for (let step = 0; step <= 64; step++) {
      const angle = start + (step * tau) / count / 64;
      polygon.push({
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
      });
    }
    for (const [axis, edge, sign] of [
      ["x", 0, 1],
      ["x", v.width, -1],
      ["y", 0, 1],
      ["y", v.height, -1],
    ] as const) {
      const input = polygon;
      polygon = [];
      input.forEach((p, i) => {
        const q = input[(i + 1) % input.length],
          pin = (p[axis] - edge) * sign >= 0,
          qin = (q[axis] - edge) * sign >= 0;
        if (pin) polygon.push(p);
        if (pin !== qin) {
          const t = (edge - p[axis]) / (q[axis] - p[axis]);
          polygon.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) });
        }
      });
    }
    let area = 0,
      x = 0,
      y = 0;
    polygon.forEach((p, i) => {
      const q = polygon[(i + 1) % polygon.length],
        cross = p.x * q.y - q.x * p.y;
      area += cross;
      x += (p.x + q.x) * cross;
      y += (p.y + q.y) * cross;
    });
    if (Math.abs(area) < 2) continue; // No visible area (or a subpixel sliver).
    const angle = start + Math.PI / count,
      outer = {
        x: center.x + Math.cos(angle) * r * 0.94,
        y: center.y + Math.sin(angle) * r * 0.94,
      };
    result.push({
      index,
      polygon,
      anchor:
        outer.x >= 0 &&
        outer.x <= v.width &&
        outer.y >= 0 &&
        outer.y <= v.height
          ? outer
          : { x: x / (3 * area), y: y / (3 * area) },
    });
  }
  return result;
}

export function boxesOverlap(a: LabelBox, b: LabelBox, gap = 0) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

export function contextualSectors(c: Camera, v: Viewport, count: number) {
  const visible = sectorFootprints(c, v, count);
  if (c.z <= 1.1) return visible;
  // The sector under the viewport centre and its closest visible neighbours.
  // At the radar centre there is no unique direction: use the largest visible
  // footprints, rather than flickering labels in response to pointer movement.
  const area = (s: SectorFootprint) =>
    Math.abs(
      s.polygon.reduce((sum, p, i) => {
        const q = s.polygon[(i + 1) % s.polygon.length];
        return sum + p.x * q.y - p.y * q.x;
      }, 0),
    );
  const angle = (Math.atan2(-c.y, -c.x) + Math.PI / 2 + tau) % tau;
  const sector =
    Math.hypot(c.x, c.y) > 10
      ? Math.floor((angle / tau) * count)
      : ([...visible].sort((a, b) => area(b) - area(a) || a.index - b.index)[0]
          ?.index ?? 0);
  const distance = (index: number) =>
    Math.min(
      (index - sector + count) % count,
      (sector - index + count) % count,
    );
  const limit = c.z >= 2.8 ? 3 : 5;
  return visible
    .sort(
      (a, b) =>
        distance(a.index) - distance(b.index) ||
        area(b) - area(a) ||
        a.index - b.index,
    )
    .slice(0, limit);
}

export function layoutRadarLabels(
  c: Camera,
  v: Viewport,
  count: number,
  obstacles: LabelBox[] = [],
) {
  const width = v.width < 650 ? 138 : 206,
    height =
      v.width < 650 ? (obstacles.some((b) => b.width > 300) ? 54 : 64) : 64,
    placed: LabelBox[] = [],
    center = { x: v.width / 2 + c.x, y: v.height / 2 + c.y },
    r = radarRadius(v) * c.z;
  const sectors = contextualSectors(c, v, count);
  const narrowRest =
    v.width < 650 &&
    c.z === 1 &&
    Math.abs(c.x) < 0.5 &&
    Math.abs(c.y) < 0.5 &&
    !obstacles.some((b) => b.width > 300);
  if (narrowRest) {
    // On a narrow resting view, give the side sectors first use of the scarce
    // outside corners; the top/bottom sectors can use the remaining edge space.
    const sidePriority = (index: number) => {
      const a = ((index + 0.5) * tau) / count - Math.PI / 2;
      return Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 0 : 1;
    };
    sectors.sort((a, b) => sidePriority(a.index) - sidePriority(b.index));
  }
  const labels = sectors.map((sector) => {
    const angle = ((sector.index + 0.5) * tau) / count - Math.PI / 2,
      target = {
        x: bound(
          center.x + Math.cos(angle) * (r + width / 2 + 15) - width / 2,
          8,
          v.width - width - 8,
        ),
        y: bound(
          center.y + Math.sin(angle) * (r + height / 2 + 15) - height / 2,
          8,
          v.height - height - 8,
        ),
      },
      candidates = [target],
      occupied = [...obstacles, ...placed];
    if (c.z > 1.1) {
      const edgeTargets = [
        {
          x: 8,
          y: bound(sector.anchor.y - height / 2, 8, v.height - height - 8),
        },
        {
          x: v.width - width - 8,
          y: bound(sector.anchor.y - height / 2, 8, v.height - height - 8),
        },
        { x: bound(sector.anchor.x - width / 2, 8, v.width - width - 8), y: 8 },
        {
          x: bound(sector.anchor.x - width / 2, 8, v.width - width - 8),
          y: v.height - height - 8,
        },
      ];
      const nearest = edgeTargets.sort(
        (a, b) =>
          Math.hypot(
            a.x + width / 2 - sector.anchor.x,
            a.y + height / 2 - sector.anchor.y,
          ) -
          Math.hypot(
            b.x + width / 2 - sector.anchor.x,
            b.y + height / 2 - sector.anchor.y,
          ),
      )[0];
      Object.assign(target, nearest);
    }
    if (narrowRest && Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
      target.x = Math.cos(angle) > 0 ? v.width - width - 8 : 8;
      target.y = Math.sin(angle) > 0 ? v.height - height - 8 : 8;
    }
    const xs = [8, v.width - width - 8, target.x],
      ys = [8, v.height - height - 8, target.y];
    occupied.forEach((b) => {
      xs.push(b.x - width - 6, b.x + b.width + 6);
      ys.push(b.y - height - 6, b.y + b.height + 6);
    });
    xs.forEach((x) =>
      ys.forEach((y) => {
        if (
          x >= 8 &&
          x <= v.width - width - 8 &&
          y >= 8 &&
          y <= v.height - height - 8
        )
          candidates.push({ x, y });
      }),
    );
    // Candidate grid is only a collision fallback; positions are ranked by
    // distance to this sector's projected circumference, never a fixed rail.
    for (let x = 8; x <= v.width - width - 8; x += 22)
      for (let y = 8; y <= v.height - height - 8; y += 18)
        candidates.push({ x, y });
    const free = candidates.filter(
      (p) => !occupied.some((b) => boxesOverlap({ ...p, width, height }, b, 5)),
    );
    // Prefer labels outside the circle; zoomed/obstructed views may have no
    // outside space, in which case retain the existing collision-safe fallback.
    const outside = free.filter(
      (p) =>
        Math.hypot(
          bound(center.x, p.x, p.x + width) - center.x,
          bound(center.y, p.y, p.y + height) - center.y,
        ) >=
        r + 6,
    );
    const edges = free.filter(
      (p) =>
        p.x === 8 ||
        p.y === 8 ||
        p.x === v.width - width - 8 ||
        p.y === v.height - height - 8,
    );
    const choice = (
      c.z > 1.1 && edges.length
        ? edges
        : c.z <= 1.1 && outside.length
          ? outside
          : free.length
            ? free
            : candidates
    ).sort(
      (a, b) =>
        Math.hypot(a.x - target.x, a.y - target.y) -
        Math.hypot(b.x - target.x, b.y - target.y),
    )[0];
    const box = { ...choice, width, height };
    placed.push(box);
    return {
      ...sector,
      box,
      end: {
        x: bound(sector.anchor.x, box.x, box.x + width),
        y: bound(sector.anchor.y, box.y, box.y + height),
      },
    };
  });
  return labels.sort((a, b) => a.index - b.index);
}
