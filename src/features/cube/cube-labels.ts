export type VertexAnchor = {
  index: number;
  x: number;
  y: number;
  depth: number;
  visible: boolean;
};
export type CubeLabel = VertexAnchor & {
  left: number;
  top: number;
  width: number;
  height: number;
};
export function shortDirection(name: string) {
  if (name.startsWith("AR/VR")) return "AR/VR и интерфейсы";
  if (name.startsWith("Искусственный интеллект"))
    return "ИИ и цифровые двойники";
  if (name.startsWith("Средства роботизации")) return "Роботизация процессов";
  if (name.startsWith("Средства коллаборации")) return "Коллаборация";
  if (name.startsWith("Беспилотные воздушные")) return "Беспилотная авиация";
  if (name.startsWith("Блокчейн")) return "Блокчейн";
  if (name.startsWith("Робототехника")) return "Робототехника / 3D";
  return name;
}
/** Screen-space callouts only. World coordinates and data positions never change. */
export function layoutCubeLabels(
  anchors: VertexAnchor[],
  width: number,
  height: number,
  selected: number | number[] | null,
  size = { width: 124, height: 28 },
  reserved: CubeLabel[] = [],
) {
  const placed: CubeLabel[] = [];
  const preferred =
    selected === null ? [] : Array.isArray(selected) ? selected : [selected];
  const rank = (index: number) => {
    const value = preferred.indexOf(index);
    return value < 0 ? preferred.length : value;
  };
  const w = Math.min(size.width, width / 3),
    h = size.height,
    gap = 6;
  for (const anchor of [...anchors]
    .filter((a) => a.visible)
    .sort(
      (a, b) =>
        rank(a.index) - rank(b.index) || a.depth - b.depth || a.index - b.index,
    )) {
    const candidates = [0, -34, 34, -68, 68].flatMap((dy) =>
      (anchor.x < width / 2 ? [-1, 1] : [1, -1]).map((side) => ({
        ...anchor,
        left: side === 1 ? anchor.x + 12 : anchor.x - w - 12,
        top: anchor.y - h / 2 + dy,
        width: w,
        height: h,
      })),
    );
    const candidate = candidates.find(
      (c) =>
        c.left >= 8 &&
        c.left + w <= width - 8 &&
        c.top >= 54 &&
        c.top + h <= height - 36 &&
        ![...placed, ...reserved].some(
          (p) =>
            c.left < p.left + p.width + gap &&
            c.left + w + gap > p.left &&
            c.top < p.top + p.height + gap &&
            c.top + h + gap > p.top,
        ),
    );
    if (candidate) placed.push(candidate);
  }
  return placed;
}
