"use client";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { layoutRadarLabels, type LabelBox } from "@/domain/radar-labels";
import type { Camera, Viewport } from "@/domain/camera";

export function RadarLabels({
  camera,
  viewport,
  directions,
  highlight,
  onHighlight,
}: {
  camera: Camera;
  viewport: Viewport;
  directions: { id: string; name: string }[];
  highlight: number | null;
  onHighlight: (index: number | null) => void;
}) {
  const root = useRef<HTMLDivElement>(null),
    [obstacles, setObstacles] = useState<LabelBox[]>([]);
  useLayoutEffect(() => {
    const node = root.current!,
      workspace = node.closest(".scenario-workspace")!;
    const selector =
      ".radar-tools, .scenario-inspector, [data-floating-scenario-inspector]";
    let frame = 0;
    const measure = () => {
      const container = node.getBoundingClientRect();
      const next = [
        ...workspace.querySelectorAll(selector),
        ...document.querySelectorAll("[data-floating-scenario-inspector]"),
      ]
        .map((n) => {
          const b = n.getBoundingClientRect();
          return {
            x: b.left - container.left,
            y: b.top - container.top,
            width: b.width,
            height: b.height,
          };
        })
        .filter((box) => box.width > 0 && box.height > 0);
      setObstacles((previous) =>
        previous.length === next.length &&
        previous.every(
          (b, i) =>
            Math.max(
              Math.abs(b.x - next[i].x),
              Math.abs(b.y - next[i].y),
              Math.abs(b.width - next[i].width),
              Math.abs(b.height - next[i].height),
            ) < 0.5,
        )
          ? previous
          : next,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    const position = new MutationObserver(schedule);
    const observeObstacles = () => {
      resize.disconnect();
      position.disconnect();
      resize.observe(node);
      resize.observe(workspace);
      workspace
        .querySelectorAll(selector)
        .forEach((element) => resize.observe(element));
      const floating = document.querySelector(
        "[data-floating-scenario-inspector]",
      );
      if (floating) {
        resize.observe(floating);
        position.observe(floating, {
          attributes: true,
          attributeFilter: ["style"],
        });
      }
      schedule();
    };
    const mounts = new MutationObserver((changes) => {
      if (
        changes.some((change) =>
          [...change.addedNodes, ...change.removedNodes].some(
            (element) =>
              element instanceof Element &&
              (element.matches(selector) || element.querySelector(selector)),
          ),
        )
      )
        observeObstacles();
    });
    mounts.observe(workspace, { childList: true, subtree: true });
    mounts.observe(document.body, { childList: true });
    workspace.addEventListener("animationend", schedule);
    window.addEventListener("scroll", schedule, true);
    observeObstacles();
    measure();
    return () => {
      cancelAnimationFrame(frame);
      mounts.disconnect();
      resize.disconnect();
      position.disconnect();
      workspace.removeEventListener("animationend", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, []);
  const labels = useMemo(
    () => layoutRadarLabels(camera, viewport, directions.length, obstacles),
    [camera, viewport, directions.length, obstacles],
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
      {labels.map(({ index, box, inspectorFit }) => (
        <div
          key={directions[index].id}
          className="direction-label"
          data-sector={index}
          data-active={highlight === index || undefined}
          data-compact={box.height < 60 || undefined}
          data-inspector-fit={inspectorFit || undefined}
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
