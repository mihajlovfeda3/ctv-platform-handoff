"use client";
import { useEffect, useRef } from "react";
export function OverviewEnvironment({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current!,
      media = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (document.hidden || media.matches || event.pointerType !== "mouse")
        return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = node.getBoundingClientRect();
        node.style.setProperty(
          "--light-x",
          `${((event.clientX - r.left) / r.width - 0.5) * 84}px`,
        );
        node.style.setProperty(
          "--light-y",
          `${((event.clientY - r.top) / r.height - 0.5) * 56}px`,
        );
      });
    };
    const reset = () => {
      cancelAnimationFrame(frame);
      node.style.setProperty("--light-x", "0px");
      node.style.setProperty("--light-y", "0px");
    };
    const visibility = () => {
      node.dataset.paused = String(document.hidden);
      if (document.hidden) reset();
    };
    visibility();
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", reset);
    media.addEventListener("change", reset);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      reset();
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", reset);
      media.removeEventListener("change", reset);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <div ref={root} className={className} data-overview-environment>
      <div className="overview-material" aria-hidden="true">
        <div className="overview-fold" />
        <div className="overview-illumination" />
        <div className="overview-light" />
      </div>
      {children}
    </div>
  );
}
