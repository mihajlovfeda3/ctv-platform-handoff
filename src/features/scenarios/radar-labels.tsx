"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { layoutRadarLabels, type LabelBox } from "@/domain/radar-labels";
import type { Camera, Viewport } from "@/domain/camera";

export function RadarLabels({
  camera,
  viewport,
  directions,
  inspectorOpen,
  highlight,
  onHighlight,
}: {
  camera: Camera;
  viewport: Viewport;
  directions: { id: string; name: string }[];
  inspectorOpen: boolean;
  highlight: number | null;
  onHighlight: (index: number | null) => void;
}) {
  const root = useRef<HTMLDivElement>(null),
    [obstacles, setObstacles] = useState<LabelBox[]>([]);
  useLayoutEffect(() => {
    const node = root.current!,
      workspace = node.closest(".scenario-workspace")!;
    const measure = () =>
      setObstacles(
        [
          ...workspace.querySelectorAll(".radar-tools, .scenario-inspector"),
        ].map((n) => {
          const b = n.getBoundingClientRect();
          const container = node.getBoundingClientRect();
          return {
            x: b.left - container.left,
            y: b.top - container.top,
            width: b.width,
            height: b.height,
          };
        }),
      );
    measure();
    const observer = new ResizeObserver(measure);
    workspace
      .querySelectorAll(".radar-tools, .scenario-inspector")
      .forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [viewport, inspectorOpen]);
  const labels = layoutRadarLabels(
    camera,
    viewport,
    directions.length,
    obstacles,
  );
  return (
    <div
      ref={root}
      className="direction-labels"
      aria-label="Видимые технологические направления"
    >
      <svg
        className="direction-leaders"
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        aria-hidden="true"
      >
        {labels.map(({ index, anchor, end }) => (
          <g key={index} className={highlight === index ? "active" : ""}>
            <line x1={anchor.x} y1={anchor.y} x2={end.x} y2={end.y} />
            <circle cx={anchor.x} cy={anchor.y} r={2.5} />
          </g>
        ))}
      </svg>
      {labels.map(({ index, box }) => (
        <div
          key={directions[index].id}
          className="direction-label"
          data-sector={index}
          data-active={highlight === index || undefined}
          data-compact={box.height < 60 || undefined}
          style={{
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
          }}
          title={directions[index].name}
          tabIndex={0}
          onMouseEnter={() => onHighlight(index)}
          onMouseLeave={() => onHighlight(null)}
          onFocus={() => onHighlight(index)}
          onBlur={() => onHighlight(null)}
        >
          <span>{directions[index].name}</span>
        </div>
      ))}
    </div>
  );
}
