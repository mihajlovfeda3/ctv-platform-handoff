"use client";
import {
  useLayoutEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
  type PointerEvent,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import { Maximize2 } from "lucide-react";
import { ContextLink as Link } from "./camera-context";
import { CardLink } from "./scroll-context";
import styles from "./floating-inspector.module.css";

type Position = { x: number; y: number };

function withinViewport(position: Position, panel: HTMLElement): Position {
  const edge = 8;
  const root = document.documentElement;
  const maxX = Math.max(edge, root.clientWidth - panel.offsetWidth - edge);
  const maxY = Math.max(edge, root.clientHeight - panel.offsetHeight - edge);
  const workspaceLeft =
    document.getElementById("main-content")?.getBoundingClientRect().left ?? 0;
  const minX = Math.min(maxX, Math.max(edge, workspaceLeft + edge));
  return {
    x: Math.min(maxX, Math.max(minX, position.x)),
    y: Math.min(maxY, Math.max(edge, position.y)),
  };
}

export function FloatingInspector({
  position,
  setPosition,
  title,
  closeHref,
  fullHref,
  returnHref,
  closeRef,
  onExpand,
}: {
  position: Position;
  setPosition: Dispatch<SetStateAction<Position | null>>;
  title: string;
  closeHref: string;
  fullHref: string;
  returnHref: string;
  closeRef: Ref<HTMLAnchorElement>;
  onExpand: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const expand = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const clamp = () =>
      setPosition((current) => {
        if (!current) return current;
        const next = withinViewport(current, element);
        return next.x === current.x && next.y === current.y ? current : next;
      });
    clamp();
    expand.current?.focus({ preventScroll: true });
    const observer = new ResizeObserver(clamp);
    observer.observe(element);
    const workspace = document.getElementById("main-content");
    if (workspace) observer.observe(workspace);
    window.addEventListener("resize", clamp);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", clamp);
    };
  }, [setPosition]);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (
      event.button !== 0 ||
      drag.current ||
      (event.target as Element).closest("button, a")
    )
      return;
    const rect = panel.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: event.pointerId,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId || !panel.current) return;
    event.stopPropagation();
    setPosition(
      withinViewport(
        {
          x: event.clientX - drag.current.x,
          y: event.clientY - drag.current.y,
        },
        panel.current,
      ),
    );
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    event.stopPropagation();
    drag.current = null;
  }

  return createPortal(
    <aside
      ref={panel}
      data-floating-scenario-inspector
      className={styles.panel}
      style={{ left: position.x, top: position.y }}
      role="region"
      aria-label="Быстрый просмотр сценария"
    >
      <div
        className={styles.handle}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        <h2 className={styles.title} title={title}>
          {title}
        </h2>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.iconButton}
            ref={expand}
            onClick={onExpand}
            aria-label="Развернуть инспектор"
            title="Развернуть инспектор"
          >
            <Maximize2 size={14} aria-hidden="true" />
          </button>
          <Link
            className={styles.close}
            ref={closeRef}
            href={closeHref}
            replace
            scroll={false}
            aria-label="Закрыть инспектор"
            title="Закрыть инспектор"
          >
            ×
          </Link>
        </div>
      </div>
      <CardLink
        className={`button ${styles.cardLink}`}
        href={fullHref}
        returnHref={returnHref}
      >
        Открыть полную карточку →
      </CardLink>
    </aside>,
    document.body,
  );
}
