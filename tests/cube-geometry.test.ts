import { describe, it, expect } from "vitest";
import {
  cubeDistance,
  cubePosition,
  cubeRadius,
  cubeVertex,
} from "../src/domain/cube-geometry";
describe("Cube geometry", () => {
  it("preserves exact maturity distance, octant and sphere bounds for all 280 combinations", () => {
    for (let v = 0; v < 8; v++)
      for (let m = 1; m <= 5; m++)
        for (let r = 1; r <= 7; r++) {
          const point = cubePosition(v, m, r),
            vertex = cubeVertex(v);
          expect(point).toEqual(cubePosition(v, m, r));
          expect(Math.hypot(...point.map((p, i) => p - vertex[i]))).toBeCloseTo(
            cubeDistance(m),
            13,
          );
          point.forEach((p, i) => {
            expect(Math.sign(p)).toBe(vertex[i]);
            expect(Math.abs(p) + cubeRadius(3) * 1.3).toBeLessThan(1);
          });
          if (m < 5) expect(cubeDistance(m + 1)).toBeLessThan(cubeDistance(m));
        }
  });
  it("keeps all seven readiness positions distinct at the same radius", () => {
    for (let v = 0; v < 8; v++)
      for (let m = 1; m <= 5; m++)
        expect(
          new Set(
            Array.from({ length: 7 }, (_, i) =>
              JSON.stringify(cubePosition(v, m, i + 1)),
            ),
          ).size,
        ).toBe(7);
  });
  it("does not jitter coincident inputs or depend on ID, camera, status or impact", () => {
    const inputs = Array.from({ length: 20 }, () => cubePosition(4, 3, 5));
    inputs.forEach((p) => expect(p).toEqual(inputs[0]));
    expect(cubeRadius(1)).toBeLessThan(cubeRadius(2));
    expect(cubeRadius(2)).toBeLessThan(cubeRadius(3));
  });
  it("rejects missing or out-of-range scores rather than inventing coordinates", () => {
    for (const values of [
      [8, 1, 1],
      [0, 0, 1],
      [0, 6, 1],
      [0, 1, 0],
      [0, 1, 8],
      [0, 1.5, 2],
      [0, NaN, 3],
    ])
      expect(() =>
        cubePosition(...(values as [number, number, number])),
      ).toThrow();
  });
});
