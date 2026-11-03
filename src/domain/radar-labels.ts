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

function leaderCrossesBox(start: Point, end: Point, box: LabelBox) {
  let enter = 0,
    exit = 1;
  for (const [axis, size] of [
    ["x", "width"],
    ["y", "height"],
  ] as const) {
    const delta = end[axis] - start[axis];
    if (delta === 0) {
      if (start[axis] < box[axis] || start[axis] > box[axis] + box[size])
        return false;
      continue;
    }
    const a = (box[axis] - start[axis]) / delta;
    const b = (box[axis] + box[size] - start[axis]) / delta;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return false;
  }
  return true;
}

function distanceFromLeader(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x,
    dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? bound(
        ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
        0,
        1,
      )
    : 0;
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy);
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
  const labels = sectors.flatMap((sector) => {
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
    const reach = 120;
    for (
      let x = Math.max(8, sector.anchor.x - reach - width);
      x <= Math.min(v.width - width - 8, sector.anchor.x + reach);
      x += 22
    )
      for (
        let y = Math.max(8, sector.anchor.y - reach - height);
        y <= Math.min(v.height - height - 8, sector.anchor.y + reach);
        y += 18
      )
        candidates.push({ x, y });
    const free = candidates.filter(
      (p) => !occupied.some((b) => boxesOverlap({ ...p, width, height }, b, 5)),
    );
    const leaderEnd = (p: Point) => ({
      x: bound(sector.anchor.x, p.x, p.x + width),
      y: bound(sector.anchor.y, p.y, p.y + height),
    });
    const choice = free
      .filter((p) => {
        const end = leaderEnd(p);
        if (
          Math.hypot(end.x - sector.anchor.x, end.y - sector.anchor.y) >
            reach ||
          obstacles.some((b) => leaderCrossesBox(sector.anchor, end, b))
        )
          return false;
        if (c.z > 1.1) {
          const anchorDistance = Math.hypot(
            sector.anchor.x - center.x,
            sector.anchor.y - center.y,
          );
          return (
            distanceFromLeader(center, sector.anchor, end) >=
            Math.min(anchorDistance, 56) - 0.01
          );
        }
        const dx = end.x - center.x,
          dy = end.y - center.y;
        // At rest the whole label stays outside the circle, with the leader
        // pointing outward from its own sector instead of crossing the plot.
        return (
          Math.hypot(
            bound(center.x, p.x, p.x + width) - center.x,
            bound(center.y, p.y, p.y + height) - center.y,
          ) >=
            r + 6 && dx * Math.cos(angle) + dy * Math.sin(angle) >= r * 0.76
        );
      })
      .sort(
        (a, b) =>
          Math.hypot(a.x - target.x, a.y - target.y) -
          Math.hypot(b.x - target.x, b.y - target.y),
      )[0];
    if (!choice) return [];
    const box = { ...choice, width, height };
    placed.push(box);
    return [
      {
        ...sector,
        box,
        end: leaderEnd(box),
        inspectorFit: false,
      },
    ];
  });
  // The expanded inspector can hide the perimeter at 1×. Give an obstructed
  // sector a smaller label beside a visible point on that same sector.
  if (c.z <= 1.1 && obstacles.some((box) => box.width > 300)) {
    const compactWidth = 132,
      compactHeight = 54;
    for (const sector of sectors) {
      if (labels.some((label) => label.index === sector.index)) continue;
      const occupied = [...obstacles, ...placed];
      let best: (typeof labels)[number] | undefined;
      let bestScore = Infinity;
      for (const fraction of [0.5, 0.25, 0.75]) {
        const angle = ((sector.index + fraction) * tau) / count - Math.PI / 2;
        for (const radial of [0.94, 0.78, 0.62, 0.46, 0.3]) {
          const anchor = {
            x: center.x + Math.cos(angle) * r * radial,
            y: center.y + Math.sin(angle) * r * radial,
          };
          if (
            anchor.x < 0 ||
            anchor.x > v.width ||
            anchor.y < 0 ||
            anchor.y > v.height ||
            obstacles.some((box) => leaderCrossesBox(anchor, anchor, box))
          )
            continue;
          for (const horizontal of [-1, 0, 1])
            for (const vertical of [-1, 0, 1]) {
              if (!horizontal && !vertical) continue;
              const box = {
                x: bound(
                  anchor.x -
                    compactWidth / 2 +
                    horizontal * (compactWidth / 2 + 11),
                  8,
                  v.width - compactWidth - 8,
                ),
                y: bound(
                  anchor.y -
                    compactHeight / 2 +
                    vertical * (compactHeight / 2 + 11),
                  8,
                  v.height - compactHeight - 8,
                ),
                width: compactWidth,
                height: compactHeight,
              };
              if (occupied.some((other) => boxesOverlap(box, other, 5)))
                continue;
              const end = {
                x: bound(anchor.x, box.x, box.x + box.width),
                y: bound(anchor.y, box.y, box.y + box.height),
              };
              const length = Math.hypot(end.x - anchor.x, end.y - anchor.y);
              const distanceFromCenter = Math.hypot(
                bound(center.x, box.x, box.x + box.width) - center.x,
                bound(center.y, box.y, box.y + box.height) - center.y,
              );
              if (
                length < 5 ||
                length > 38 ||
                distanceFromCenter < Math.min(52, r * 0.28) ||
                obstacles.some((other) => leaderCrossesBox(anchor, end, other))
              )
                continue;
              const score =
                length +
                Math.max(0, r - distanceFromCenter) * 0.7 +
                Math.hypot(
                  anchor.x - sector.anchor.x,
                  anchor.y - sector.anchor.y,
                ) *
                  0.35;
              if (score < bestScore) {
                best = { ...sector, anchor, box, end, inspectorFit: true };
                bestScore = score;
              }
            }
        }
      }
      if (best) {
        placed.push(best.box);
        labels.push(best);
      }
    }
  }
  return labels.sort((a, b) => a.index - b.index);
}
