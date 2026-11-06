import { expect, it } from "vitest";
import { cubePosition, cubeDistance } from "../src/domain/cube-geometry";
import { cubeReadinessGuides } from "../src/features/cube/cube-readiness-guides";

it("all 280 real positions lie on the guide matching their readiness", () => {
  for (let vertex = 0; vertex < 8; vertex++) {
    const guides = cubeReadinessGuides(vertex);
    expect(guides.map((guide) => guide.value)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const guide of guides)
      for (let maturity = 1; maturity <= 5; maturity++) {
        const t =
          (cubeDistance(maturity) - cubeDistance(5)) /
          (cubeDistance(1) - cubeDistance(5));
        const interpolated = guide.start.map(
          (value, axis) => value + t * (guide.end[axis] - value),
        );
        const actual = cubePosition(vertex, maturity, guide.value);
        expect(
          Math.hypot(
            ...actual.map((value, axis) => value - interpolated[axis]),
          ),
        ).toBeLessThan(1e-12);
      }
    expect(new Set(guides.map((guide) => JSON.stringify(guide.end))).size).toBe(
      7,
    );
    expect(cubeReadinessGuides(vertex)).toEqual(guides);
  }
});
