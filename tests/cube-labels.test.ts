import { expect, it } from "vitest";
import {
  layoutCubeLabels,
  shortDirection,
} from "../src/features/cube/cube-labels";
it("packs labels deterministically without overlaps or long leaders", () => {
  for (const width of [650, 800, 1300]) {
    const anchors = Array.from({ length: 8 }, (_, index) => ({
      index,
      x: width / 2 + (index % 2 ? 50 : -50),
      y: 180 + Math.floor(index / 2) * 55,
      depth: index / 10,
      visible: true,
    }));
    const result = layoutCubeLabels(anchors, width, 600, null);
    expect(result).toEqual(layoutCubeLabels(anchors, width, 600, null));
    expect(result.length).toBe(8);
    for (const a of result) {
      expect(a.left).toBeGreaterThanOrEqual(8);
      expect(a.left + a.width).toBeLessThanOrEqual(width - 8);
      const dx = Math.max(a.left - a.x, 0, a.x - a.left - a.width),
        dy = Math.max(a.top - a.y, 0, a.y - a.top - a.height);
      expect(Math.hypot(dx, dy)).toBeLessThan(100);
      for (const b of result.filter((b) => b.index !== a.index))
        expect(
          a.left >= b.left + b.width ||
            b.left >= a.left + a.width ||
            a.top >= b.top + b.height ||
            b.top >= a.top + a.height,
        ).toBe(true);
    }
  }
});
it("does not label vertices outside the view and prioritizes selection in dense projections", () => {
  const anchors = Array.from({ length: 8 }, (_, index) => ({
    index,
    x: 200,
    y: 200,
    depth: index,
    visible: index !== 7,
  }));
  const result = layoutCubeLabels(anchors, 500, 500, 5);
  expect(result[0].index).toBe(5);
  expect(result.some((p) => p.index === 7)).toBe(false);
  expect(
    shortDirection(
      "Искусственный интеллект, цифровые двойники и цифровые модели",
    ),
  ).toBe("ИИ и цифровые двойники");
});

it("keeps maturity callouts clear of direction labels", () => {
  const anchors = Array.from({ length: 5 }, (_, index) => ({
    index,
    x: 300 + index * 10,
    y: 250 + index * 10,
    depth: 0,
    visible: true,
  }));
  const reserved = layoutCubeLabels(
    [{ index: 7, x: 300, y: 250, depth: 0, visible: true }],
    650,
    520,
    7,
  );
  const levels = layoutCubeLabels(
    anchors,
    650,
    520,
    null,
    { width: 40, height: 18 },
    reserved,
  );
  expect(levels.length).toBe(5);
  for (const level of levels)
    for (const direction of reserved)
      expect(
        level.left >= direction.left + direction.width ||
          direction.left >= level.left + level.width ||
          level.top >= direction.top + direction.height ||
          direction.top >= level.top + level.height,
      ).toBe(true);
});

it("prioritizes both selected maturity and readiness labels in a dense projection", () => {
  const anchors = Array.from({ length: 12 }, (_, index) => ({
    index,
    x: 250,
    y: 250,
    depth: index,
    visible: true,
  }));
  const labels = layoutCubeLabels(anchors, 600, 600, [2, 8], {
    width: 40,
    height: 18,
  });
  expect(labels.slice(0, 2).map((p) => p.index)).toEqual([2, 8]);
});
