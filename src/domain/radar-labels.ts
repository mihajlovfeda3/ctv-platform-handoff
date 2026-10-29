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

export function layoutRadarLabels(
  c: Camera,
  v: Viewport,
  count: number,
  obstacles: LabelBox[] = [],
) {
  const width = v.width < 650 ? 138 : 206,
    height =
      v.width < 650 ? (obstacles.some((b) => b.width > 300) ? 54 : 70) : 64,
    placed: LabelBox[] = [],
    center = { x: v.width / 2 + c.x, y: v.height / 2 + c.y },
    r = radarRadius(v) * c.z;
  return sectorFootprints(c, v, count).map((sector) => {
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
    const choice = (free.length ? free : candidates).sort(
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
}
