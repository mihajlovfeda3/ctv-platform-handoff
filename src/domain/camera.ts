export type Camera = { z: number; x: number; y: number };
export type Viewport = { width: number; height: number };
export const radarRadius = (v: Viewport) => Math.min(v.width, v.height) * 0.4;
// Keep a central disk of radius 28% of the short viewport side inside the radar.
// This is stronger than a bounding-box overlap, including at diagonal limits.
export function clampCamera(c: Camera, v: Viewport): Camera {
  const z = Math.max(1, Math.min(8, Number.isFinite(c.z) ? c.z : 1));
  const x = Number.isFinite(c.x) ? c.x : 0,
    y = Number.isFinite(c.y) ? c.y : 0;
  const max = radarRadius(v) * z - Math.min(v.width, v.height) * 0.28;
  const distance = Math.hypot(x, y),
    factor = distance > max ? max / distance : 1;
  return { z, x: x * factor, y: y * factor };
}
export function matrixPosition(
  id: string,
  maturity: number,
  readiness: number,
) {
  const n = parseInt(id.replaceAll("-", "").slice(-8), 16) >>> 0;
  return {
    x: readiness + ((n % 1000) / 1000 - 0.5) * 0.58,
    y: maturity + (((n >>> 10) % 1000) / 1000 - 0.5) * 0.58,
  };
}
export function visibleSectors(c: Camera, v: Viewport, count: number) {
  const found = new Set<number>(),
    r = radarRadius(v) * c.z;
  for (let gx = 0; gx <= 12; gx++)
    for (let gy = 0; gy <= 8; gy++) {
      const x = (v.width * gx) / 12 - v.width / 2 - c.x,
        y = (v.height * gy) / 8 - v.height / 2 - c.y;
      if (Math.hypot(x, y) <= r) {
        const a =
          (Math.atan2(y, x) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
        found.add(Math.min(count - 1, Math.floor((a / (Math.PI * 2)) * count)));
      }
    }
  return [...found].sort((a, b) => a - b);
}
