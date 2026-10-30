import { expect, it } from "vitest";
import {
  buildRadarHierarchy,
  groupRadius,
  packRadarGroups,
  radarPointScreenRadius,
  visibleRadarClusters,
} from "../src/domain/radar-clusters";
import { pointPosition, type Analytics } from "../src/domain/analytics";
import { stableId } from "../src/lib/identity";

const directions = Array.from({ length: 8 }, (_, i) => ({
  id: `d${i}`,
  name: `Синтетическое направление ${i}`,
}));
function dataset(size: number): Analytics {
  return {
    directions,
    total: size,
    context: "synthetic-lab",
    rows: Array.from({ length: size }, (_, i) => ({
      id: stableId(`radar-unit:${i}`),
      externalId: `SYN-${i}`,
      name: `Синтетический сценарий ${i}`,
      maturity: i % 17 === 0 ? null : (i % 5) + 1,
      readiness: (i % 7) + 1,
      impact: (i % 3) + 1,
      implementation: ["yes", "no", "unknown"][i % 3],
      directions:
        i % 13 === 0
          ? [directions[i % 8], directions[(i + 1) % 8]]
          : [directions[i % 8]],
    })),
  };
}

it("partitions 80 and 2500 records deterministically, retaining semantic boundaries and original coordinates", () => {
  for (const size of [80, 2500]) {
    const data = dataset(size),
      tree = buildRadarHierarchy(data);
    const expected = data.rows.reduce(
      (n, row) => n + (row.maturity === null ? 0 : row.directions.length),
      0,
    );
    const counts = [];
    for (const zoom of [1, 3, 8]) {
      const groups = visibleRadarClusters(tree.roots, 1.2 * zoom);
      counts.push(groups.length);
      expect(groups.reduce((n, g) => n + g.rows.length, 0)).toBe(expected);
      expect(groups.map((g) => g.key)).toEqual(
        visibleRadarClusters(tree.roots, 1.2 * zoom).map((g) => g.key),
      );
      const memberships = new Set<string>();
      for (const group of groups) {
        expect(
          Object.values(group.statuses).reduce((n, count) => n + count, 0),
        ).toBe(group.rows.length);
        for (const row of group.rows) {
          expect(row.maturity).toBe(group.level);
          expect(row.directions.some((d) => d.id === group.directionId)).toBe(
            true,
          );
          const membership = `${group.directionId}:${row.id}`;
          expect(memberships.has(membership)).toBe(false);
          memberships.add(membership);
          if (group.rows.length === 1)
            expect({ x: group.x, y: group.y }).toEqual(
              pointPosition(
                row.id,
                directions.findIndex((d) => d.id === group.directionId),
                8,
                group.level,
              ),
            );
        }
      }
    }
    expect(counts[1]).toBeGreaterThan(counts[0]);
    expect(counts[2]).toBeGreaterThan(counts[1]);
    if (size === 2500) expect(counts[0]).toBeLessThan(250);
  }
});

it("keeps aggregate count glyphs apart at every scale, including dense data", () => {
  const tree = buildRadarHierarchy(dataset(2500));
  for (const scale of [0.8, 1.2, 3.6, 9.6]) {
    const packed = packRadarGroups(
      visibleRadarClusters(tree.roots, scale),
      scale,
    ).filter((p) => p.node.rows.length > 1);
    packed.forEach((p, i) => {
      for (const q of packed.slice(i + 1))
        expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThanOrEqual(
          groupRadius(p.node.rows.length) +
            groupRadius(q.node.rows.length) +
            2.99,
        );
    });
  }
});

it("retains stable selected membership across LOD changes and limits high-zoom point sizes", () => {
  const tree = buildRadarHierarchy(dataset(2500));
  const group = visibleRadarClusters(tree.roots, 1.2).find(
    (n) => n.rows.length > 3,
  )!;
  visibleRadarClusters(tree.roots, 9.6);
  expect(tree.nodes.get(group.key)).toBe(group);
  expect(radarPointScreenRadius(3, 1.5, 8)).toBeLessThan(11);
  expect(radarPointScreenRadius(1, 1.5, 8)).toBeLessThan(
    radarPointScreenRadius(3, 1.5, 8),
  );
});
