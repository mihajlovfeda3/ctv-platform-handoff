"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { clampCamera, type Camera, type Viewport } from "@/domain/camera";
export function useRadarCamera(view: string) {
  const search = useSearchParams(),
    svg = useRef<SVGSVGElement>(null);
  const [viewport, setViewport] = useState<Viewport>({
    width: 680,
    height: 580,
  });
  const read = (): Camera =>
    clampCamera(
      {
        z: Number(search.get("zoom") ?? 1),
        x: Number(search.get("panX") ?? 0),
        y: Number(search.get("panY") ?? 0),
      },
      viewport,
    );
  const [camera, setCamera] = useState<Camera>(read);
  const key = `${search.get("zoom")}:${search.get("panX")}:${search.get("panY")}:${viewport.width}:${viewport.height}`;
  const [previous, setPrevious] = useState(key);
  if (previous !== key) {
    setPrevious(key);
    setCamera(read());
  }
  const current = useRef(camera);
  const motion = useRef<{ frame: number; target: Camera } | null>(null);
  const stopMotion = () => {
    if (motion.current) cancelAnimationFrame(motion.current.frame);
    motion.current = null;
  };
  useEffect(() => () => stopMotion(), []);
  useLayoutEffect(() => {
    current.current = camera;
  }, [camera]);
  const drag = useRef<{ x: number; y: number; camera: Camera } | null>(null),
    moved = useRef(false);
  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const resize = new ResizeObserver(() => {
      const r = node.getBoundingClientRect();
      setViewport({ width: r.width, height: r.height });
    });
    resize.observe(node);
    return () => resize.disconnect();
  }, [view]);
  const save = (c: Camera) => {
    stopMotion();
    const safe = clampCamera(c, viewport);
    current.current = safe;
    setCamera(safe);
    const url = new URL(window.location.href);
    url.searchParams.set("zoom", String(safe.z));
    url.searchParams.set("panX", String(safe.x));
    url.searchParams.set("panY", String(safe.y));
    window.history.replaceState(null, "", url.pathname + url.search);
  };
  const animate = (c: Camera) => {
    stopMotion();
    const target = clampCamera(c, viewport),
      start = current.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return save(target);
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 170),
        t = 1 - Math.pow(1 - progress, 3);
      const next = clampCamera(
        {
          z: start.z + (target.z - start.z) * t,
          x: start.x + (target.x - start.x) * t,
          y: start.y + (target.y - start.y) * t,
        },
        viewport,
      );
      current.current = next;
      setCamera(next);
      if (progress < 1)
        motion.current = { target, frame: requestAnimationFrame(tick) };
      else save(target);
    };
    motion.current = { target, frame: requestAnimationFrame(tick) };
  };
  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = node.getBoundingClientRect(),
        old = motion.current?.target ?? current.current;
      const z = Math.max(1, Math.min(8, old.z * Math.exp(-e.deltaY * 0.002))),
        x = e.clientX - rect.left - rect.width / 2,
        y = e.clientY - rect.top - rect.height / 2;
      animate({
        z,
        x: x - ((x - old.x) * z) / old.z,
        y: y - ((y - old.y) * z) / old.z,
      });
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  });
  return {
    svg,
    viewport,
    camera,
    moved,
    save,
    zoom: (factor: number) => {
      const old = motion.current?.target ?? current.current,
        z = Math.max(1, Math.min(8, old.z * factor));
      animate({ z, x: (old.x * z) / old.z, y: (old.y * z) / old.z });
    },
    onKeyDown: (e: React.KeyboardEvent<SVGSVGElement>) => {
      // Marker Enter/Space and arrow navigation elsewhere keep their meaning.
      if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey)
        return;
      const old = motion.current?.target ?? current.current;
      if (["+", "=", "-", "_"].includes(e.key)) {
        e.preventDefault();
        const z = Math.max(
          1,
          Math.min(8, old.z * (["+", "="].includes(e.key) ? 1.25 : 0.8)),
        );
        animate({ z, x: (old.x * z) / old.z, y: (old.y * z) / old.z });
      } else if (e.key === "0" || e.key === "Home") {
        e.preventDefault();
        save({ z: 1, x: 0, y: 0 });
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        save({
          ...old,
          x:
            old.x +
            (e.key === "ArrowLeft" ? -40 : e.key === "ArrowRight" ? 40 : 0),
          y:
            old.y +
            (e.key === "ArrowUp" ? -40 : e.key === "ArrowDown" ? 40 : 0),
        });
      }
    },
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      stopMotion();
      drag.current = { x: e.clientX, y: e.clientY, camera: current.current };
      moved.current = false;
      // Preserve a marker's click when stationary; dense clouds must still be
      // draggable. Capture a marker-origin gesture only after its drag threshold.
      if (!(e.target as Element).closest(".radar-mark"))
        e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => {
      const origin = drag.current;
      if (!origin) return;
      const dx = e.clientX - origin.x,
        dy = e.clientY - origin.y;
      if (Math.hypot(dx, dy) > 3) {
        moved.current = true;
        if (!e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.setPointerCapture(e.pointerId);
      }
      const next = clampCamera(
        { ...origin.camera, x: origin.camera.x + dx, y: origin.camera.y + dy },
        viewport,
      );
      current.current = next;
      setCamera(next);
    },
    onPointerUp: () => {
      if (drag.current) {
        drag.current = null;
        save(current.current);
        setTimeout(() => {
          moved.current = false;
        }, 0);
      }
    },
    onPointerCancel: () => {
      drag.current = null;
      save(current.current);
      moved.current = false;
    },
  };
}
