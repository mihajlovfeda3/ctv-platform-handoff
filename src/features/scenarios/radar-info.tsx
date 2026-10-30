"use client";
import { useId, useState } from "react";
import { Info, X } from "lucide-react";
import type { Analytics } from "@/domain/analytics";

export function RadarInfo({
  data,
  markerCount,
}: {
  data: Analytics;
  markerCount: number;
}) {
  const id = useId();
  const [position, setPosition] = useState({
    left: 16,
    bottom: 16,
    maxHeight: 360,
  });
  return (
    <>
      <button
        className="radar-info-trigger"
        popoverTarget={id}
        aria-label="О диаграмме и выборке"
        title="О диаграмме и выборке"
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          setPosition({
            left: Math.max(16, Math.min(box.right - 340, innerWidth - 356)),
            bottom: innerHeight - box.top + 8,
            maxHeight: Math.max(120, box.top - 24),
          });
        }}
      >
        <Info size={17} aria-hidden="true" />
      </button>
      <div
        id={id}
        className="radar-info-popover"
        popover="auto"
        tabIndex={-1}
        style={position}
        onToggle={(event) => {
          if (event.currentTarget.matches(":popover-open"))
            event.currentTarget.focus({ preventScroll: true });
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") event.stopPropagation();
        }}
      >
        <div className="radar-info-heading">
          <h3>О диаграмме и выборке</h3>
          <button
            popoverTarget={id}
            popoverTargetAction="hide"
            aria-label="Закрыть информацию"
          >
            <X size={15} />
          </button>
        </div>
        <p>
          Уровни — рыночная зрелость от 1 до 5. Сектора — технологические
          направления.
        </p>
        <p>
          Размер точки — влияние на бизнес-цели от 1 до 3. Пунктирный контур —
          влияние неизвестно.
        </p>
        <p>
          <strong>{data.total}</strong> уникальных сценариев · {markerCount}{" "}
          маркеров. Сценарий с несколькими направлениями показан в каждом
          соответствующем секторе.
        </p>
        <p>
          Без ОГ: {data.rows.filter((r) => r.readiness === null).length} · без
          влияния: {data.rows.filter((r) => r.impact === null).length}.
        </p>
        <p className="radar-info-origin">
          Демонстрационные сценарии, оценки и связи синтетические.
        </p>
      </div>
    </>
  );
}
