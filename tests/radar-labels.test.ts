import { it, expect } from "vitest";
import { clampCamera } from "../src/domain/camera";
import {
  boxesOverlap,
  layoutRadarLabels,
  sectorFootprints,
  contextualSectors,
} from "../src/domain/radar-labels";

it("shows all eight sectors at rest and only the intersecting sector when zoomed into one", () => {
  const v = { width: 560, height: 520 };
  expect(sectorFootprints({ z: 1, x: 0, y: 0 }, v, 8)).toHaveLength(8);
  const angle = Math.PI / 8;
  const c = clampCamera(
    { z: 8, x: -1e8 * Math.cos(angle), y: -1e8 * Math.sin(angle) },
    v,
  );
  expect(sectorFootprints(c, v, 8).map((s) => s.index)).toEqual([2]);
});

it("limits zoomed labels to the focus sector and visible neighbours", () => {
  const v = { width: 1180, height: 648 };
  expect(contextualSectors({ z: 1, x: 0, y: 0 }, v, 8)).toHaveLength(8);
  expect(contextualSectors({ z: 2, x: 0, y: 0 }, v, 8)).toHaveLength(5);
  expect(contextualSectors({ z: 8, x: 0, y: 0 }, v, 8)).toHaveLength(3);
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) * Math.PI) / 4 - Math.PI / 2;
    const c = clampCamera(
      { z: 8, x: -Math.cos(a) * 1e8, y: -Math.sin(a) * 1e8 },
      v,
    );
    const labels = contextualSectors(c, v, 8).map((s) => s.index);
    expect(labels).toContain(i);
    expect(labels.length).toBeLessThanOrEqual(3);
    expect(
      labels.every((n) => sectorFootprints(c, v, 8).some((s) => s.index === n)),
    ).toBe(true);
  }
});

it("keeps geometric annotations in bounds and apart from each other and the reset control", () => {
  for (const width of [560, 1180, 1660]) {
    const v = { width, height: 594 },
      tool = { x: width - 160, y: 12, width: 144, height: 42 };
    for (const z of [1, 3, 8])
      for (let step = 0; step < 16; step++) {
        const a = (step * Math.PI) / 8;
        const c = clampCamera(
          {
            z,
            x: step === 0 ? 0 : Math.cos(a) * 1e8,
            y: step === 0 ? 0 : Math.sin(a) * 1e8,
          },
          v,
        );
        const labels = layoutRadarLabels(c, v, 8, [tool]);
        expect(labels.length).toBeGreaterThan(0);
        labels.forEach(({ box, anchor, index }, i) => {
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(v.width);
          expect(box.y + box.height).toBeLessThanOrEqual(v.height);
          expect(boxesOverlap(box, tool)).toBe(false);
          expect(
            labels.some((l, j) => j !== i && boxesOverlap(box, l.box)),
          ).toBe(false);
          const angle =
            (Math.atan2(
              anchor.y - v.height / 2 - c.y,
              anchor.x - v.width / 2 - c.x,
            ) +
              Math.PI / 2 +
              2 * Math.PI) %
            (2 * Math.PI);
          expect(Math.floor((angle / (2 * Math.PI)) * 8)).toBe(index);
        });
      }
  }
});

it("omits blocked annotations instead of moving them across the radar", () => {
  const v = { width: 560, height: 520 };
  const obstacles = [
    { x: 400, y: 12, width: 144, height: 42 },
    { x: 176, y: 65, width: 370, height: 480 },
  ];
  const labels = layoutRadarLabels({ z: 1, x: 0, y: 0 }, v, 8, obstacles);
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.length).toBeLessThan(8);
  labels.forEach(({ box, anchor, end }, i) => {
    expect(Math.hypot(end.x - anchor.x, end.y - anchor.y)).toBeLessThanOrEqual(
      120,
    );
    expect(obstacles.some((b) => boxesOverlap(box, b))).toBe(false);
    expect(labels.some((l, j) => i !== j && boxesOverlap(box, l.box))).toBe(
      false,
    );
  });
});

it("places labels outside the resting circle on the narrow radar workspace", () => {
  const v = { width: 508, height: 648 };
  for (const { box } of layoutRadarLabels({ z: 1, x: 0, y: 0 }, v, 8)) {
    const x = Math.max(box.x, Math.min(v.width / 2, box.x + box.width));
    const y = Math.max(box.y, Math.min(v.height / 2, box.y + box.height));
    expect(
      Math.hypot(x - v.width / 2, y - v.height / 2),
    ).toBeGreaterThanOrEqual(0.4 * v.width);
  }
});

it("keeps every direction readable with the desktop inspector open", () => {
  for (const [width, height] of [
    [1084, 553],
    [1158, 648],
    [1638, 778],
  ]) {
    const inspector = {
      x: width - 424,
      y: 10,
      width: 410,
      height: height - 75,
    };
    const labels = layoutRadarLabels(
      { z: 1, x: 0, y: 0 },
      { width, height },
      8,
      [inspector],
    );
    expect(labels).toHaveLength(8);
    expect(labels.some(({ box }) => box.height === 54)).toBe(true);
    for (const { box, anchor, end, index } of labels) {
      expect(boxesOverlap(box, inspector)).toBe(false);
      expect(
        Math.hypot(end.x - anchor.x, end.y - anchor.y),
      ).toBeLessThanOrEqual(120);
      const angle =
        (Math.atan2(anchor.y - height / 2, anchor.x - width / 2) +
          Math.PI / 2 +
          2 * Math.PI) %
        (2 * Math.PI);
      expect(Math.floor(angle / (Math.PI / 4))).toBe(index);
    }
  }
});
