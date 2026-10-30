"use client";
import { useEffect, useRef, useState } from "react";

export function RadarTooltip() {
  const root = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(
    null,
  );
  useEffect(() => {
    const viewport = root.current!.parentElement!,
      svg = viewport.querySelector("svg.interactive-radar")!;
    let active: Element | null = null;
    const clear = () => {
      active = null;
      setTip(null);
    };
    const show = (event: Event) => {
      const mark = (event.target as Element).closest(".radar-mark");
      if (!mark) return clear();
      if (active === mark) return;
      active = mark;
      const text = mark.querySelector("desc")?.textContent;
      if (!text) return;
      const container = viewport.getBoundingClientRect(),
        box = mark.getBoundingClientRect();
      const pointer = event as PointerEvent;
      const x = "clientX" in event ? pointer.clientX : box.left + box.width / 2;
      const y = "clientY" in event ? pointer.clientY : box.top;
      setTip({
        text,
        x: Math.max(
          8,
          Math.min(container.width - 256, x - container.left + 12),
        ),
        y: Math.max(
          8,
          Math.min(container.height - 150, y - container.top + 16),
        ),
      });
    };
    svg.addEventListener("pointermove", show);
    svg.addEventListener("focusin", show);
    for (const type of ["pointerleave", "pointerdown", "wheel", "focusout"])
      svg.addEventListener(type, clear);
    return () => {
      svg.removeEventListener("pointermove", show);
      svg.removeEventListener("focusin", show);
      for (const type of ["pointerleave", "pointerdown", "wheel", "focusout"])
        svg.removeEventListener(type, clear);
    };
  }, []);
  return (
    <div
      ref={root}
      className="radar-tooltip"
      role="tooltip"
      style={tip ? { left: tip.x, top: tip.y } : { display: "none" }}
    >
      {tip?.text}
    </div>
  );
}
