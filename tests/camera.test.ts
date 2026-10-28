import { it, expect } from "vitest";
import {
  clampCamera,
  radarRadius,
  visibleSectors,
  matrixPosition,
} from "../src/domain/camera";
it("keeps a significant visible disk at all scales and extreme diagonal pans", () => {
  for (const width of [570, 1190, 1670])
    for (const z of [1, 3, 8])
      for (const x of [-1e8, 0, 1e8])
        for (const y of [-1e8, 0, 1e8]) {
          const v = { width, height: 590 },
            c = clampCamera({ z, x, y }, v);
          expect(
            Math.hypot(c.x, c.y) + Math.min(width, 590) * 0.28,
          ).toBeLessThanOrEqual(radarRadius(v) * z + 0.0001);
          expect(visibleSectors(c, v, 8).length).toBeGreaterThan(0);
        }
});
it("normalizes nonfinite coordinates and places matrix points inside the correct bin", () => {
  expect(
    clampCamera({ z: NaN, x: Infinity, y: NaN }, { width: 1000, height: 600 }),
  ).toEqual({ z: 1, x: 0, y: 0 });
  for (let rz = 1; rz <= 5; rz++)
    for (let og = 1; og <= 7; og++) {
      const p = matrixPosition("00000000-0000-4000-8000-abcdefabcdef", rz, og);
      expect(Math.round(p.x)).toBe(og);
      expect(Math.round(p.y)).toBe(rz);
      expect(p).toEqual(
        matrixPosition("00000000-0000-4000-8000-abcdefabcdef", rz, og),
      );
    }
});
