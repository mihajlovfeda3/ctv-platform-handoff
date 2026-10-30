"use client";
import { useEffect, useId, useRef, useState } from "react";

export function MatrixTooltip() {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(
    null,
  );
  useEffect(() => {
    const stage = root.current!.parentElement!;
    let active: Element | null = null;
    const clear = () => {
      active?.removeAttribute("aria-describedby");
      active = null;
      setTip(null);
    };
    const show = (e: Event) => {
      const target = (e.target as Element).closest<HTMLElement>(
        "[data-matrix-tip]",
      );
      if (!target) return clear();
      if (active === target) return;
      active?.removeAttribute("aria-describedby");
      active = target;
      target.setAttribute("aria-describedby", id);
      const b = stage.getBoundingClientRect(),
        mark = target.getBoundingClientRect();
      const x =
        "clientX" in e
          ? (e as PointerEvent).clientX
          : mark.left + mark.width / 2;
      const y = "clientY" in e ? (e as PointerEvent).clientY : mark.top;
      setTip({
        text: target.dataset.matrixTip ?? "",
        x: Math.max(8, Math.min(b.width - 280, x - b.left + 12)),
        y: Math.max(8, Math.min(b.height - 170, y - b.top + 14)),
      });
    };
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };
    stage.addEventListener("keydown", keydown);
    stage.addEventListener("pointermove", show);
    stage.addEventListener("focusin", show);
    for (const name of ["pointerleave", "focusout", "pointerdown"])
      stage.addEventListener(name, clear);
    return () => {
      active?.removeAttribute("aria-describedby");
      stage.removeEventListener("keydown", keydown);
      stage.removeEventListener("pointermove", show);
      stage.removeEventListener("focusin", show);
      for (const name of ["pointerleave", "focusout", "pointerdown"])
        stage.removeEventListener(name, clear);
    };
  }, [id]);
  return (
    <div
      ref={root}
      id={id}
      role="tooltip"
      className="matrix-tooltip"
      style={tip ? { left: tip.x, top: tip.y } : { display: "none" }}
    >
      {tip?.text}
    </div>
  );
}
