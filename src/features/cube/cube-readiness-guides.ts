import { cubePosition } from "@/domain/cube-geometry";

/** Constant ОГ follows a radial generator of the existing placement cone. */
export function cubeReadinessGuides(vertex: number) {
  return Array.from({ length: 7 }, (_, index) => ({
    value: index + 1,
    start: cubePosition(vertex, 5, index + 1),
    end: cubePosition(vertex, 1, index + 1),
  }));
}
