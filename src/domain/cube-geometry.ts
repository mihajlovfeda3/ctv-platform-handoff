export type CubeVector = [number, number, number];
export function cubeVertex(index: number): CubeVector {
  if (!Number.isInteger(index) || index < 0 || index > 7)
    throw new Error("Вершина: 0–7");
  return [index & 1 ? 1 : -1, index & 2 ? 1 : -1, index & 4 ? 1 : -1];
}
export const cubeDistance = (maturity: number) => 0.28 + (5 - maturity) * 0.2;
/** A small cone inside each vertex's octant; readiness moves on a spherical arc. */
export function cubePosition(
  vertex: number,
  maturity: number,
  readiness: number,
): CubeVector {
  if (
    !Number.isInteger(maturity) ||
    maturity < 1 ||
    maturity > 5 ||
    !Number.isInteger(readiness) ||
    readiness < 1 ||
    readiness > 7
  )
    throw new Error("Требуются РЗ 1–5 и ОГ 1–7");
  const v = cubeVertex(vertex),
    theta = ((readiness - 1) * Math.PI * 2) / 7,
    alpha = 0.25;
  const n = 1 / Math.sqrt(3),
    a = Math.cos(alpha),
    b = Math.sin(alpha);
  const e1 = [1 / Math.sqrt(2), -1 / Math.sqrt(2), 0];
  const e2 = [1 / Math.sqrt(6), 1 / Math.sqrt(6), -2 / Math.sqrt(6)];
  return v.map(
    (sign, i) =>
      sign *
      (1 -
        cubeDistance(maturity) *
          (a * n + b * (Math.cos(theta) * e1[i] + Math.sin(theta) * e2[i]))),
  ) as CubeVector;
}
export function cubeRadius(impact: number | null) {
  return impact === 1
    ? 0.02
    : impact === 2
      ? 0.028
      : impact === 3
        ? 0.036
        : 0.015;
}
