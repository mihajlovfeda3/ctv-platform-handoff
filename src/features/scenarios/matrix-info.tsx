"use client";
import { useId, useState } from "react";
import { Info, X } from "lucide-react";
export function MatrixInfo() {
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
        aria-label="О матрице и выборке"
        title="О матрице и выборке"
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
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
        className="radar-info-popover matrix-info-popover"
        popover="auto"
        tabIndex={-1}
        style={position}
        onToggle={(e) => {
          if (e.currentTarget.matches(":popover-open"))
            e.currentTarget.focus({ preventScroll: true });
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") e.stopPropagation();
        }}
      >
        <div className="radar-info-heading">
          <h3>О матрице и выборке</h3>
          <button
            popoverTarget={id}
            popoverTargetAction="hide"
            aria-label="Закрыть информацию"
          >
            <X size={15} />
          </button>
        </div>
        <p>
          Ось X — организационная готовность 1–7, ось Y — рыночная зрелость 1–5.
          Границы стратегических областей: ОГ 3,5 и РЗ 3,5.
        </p>
        <p>
          Размер точки — влияние на бизнес-цели 1–3. Пунктирный контур — влияние
          неизвестно. В плотных выборках все точки пропорционально уменьшаются.
        </p>
        <p>
          Сценарии без РЗ или ОГ доступны отдельно. Каждый сценарий учитывается
          один раз; оба режима используют одну выборку. В режиме «Ячейки»
          нажмите на количество, чтобы открыть состав.
        </p>
        <p className="radar-info-origin">
          Демонстрационные сценарии, оценки и связи синтетические.
        </p>
      </div>
    </>
  );
}
