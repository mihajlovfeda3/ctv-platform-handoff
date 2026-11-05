import { Crosshair, MoveUpRight } from "lucide-react";
export function RadarWorkspace() {
  return (
    <section className="surface radar-workspace" aria-labelledby="radar-title">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">СЛЕДУЮЩАЯ ИТЕРАЦИЯ</div>
          <h2 id="radar-title">Технологический радар</h2>
          <p>Рабочее пространство для исследования сценариев</p>
        </div>
        <span className="tag neutral">
          <Crosshair size={13} /> Основа визуализации
        </span>
      </div>
      <div className="radar-preview">
        <svg
          viewBox="0 0 900 390"
          role="img"
          aria-label="Схематическая подложка будущего радара без данных сценариев"
        >
          <defs>
            <radialGradient id="radar-blue">
              <stop offset="0%" stopColor="#8cd3ef" />
              <stop offset="100%" stopColor="#e0f3fb" />
            </radialGradient>
          </defs>
          <circle cx="450" cy="195" r="157" fill="url(#radar-blue)" />
          {[31, 63, 94, 126, 157].map((r, i) => (
            <g key={r}>
              <circle
                cx="450"
                cy="195"
                r={r}
                fill="none"
                stroke="white"
                strokeWidth="1.5"
              />
              <text x={455 + r} y="190" fill="#347397" fontSize="9">
                {i + 1}
              </text>
            </g>
          ))}
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (i * Math.PI) / 4;
            return (
              <line
                key={i}
                x1="450"
                y1="195"
                x2={450 + Math.cos(angle) * 157}
                y2={195 + Math.sin(angle) * 157}
                stroke="white"
                strokeWidth="1.5"
              />
            );
          })}
          <circle cx="450" cy="195" r="24" fill="white" />
          <text
            x="450"
            y="199"
            textAnchor="middle"
            fill="#175480"
            fontSize="11"
            fontWeight="700"
          >
            ЦТВ
          </text>
          <text x="254" y="57" fill="#7391a3" fontSize="10">
            ТЕХНОЛОГИЧЕСКИЕ НАПРАВЛЕНИЯ
          </text>
          <line x1="290" y1="68" x2="337" y2="92" stroke="#aec7d7" />
          <text x="646" y="294" fill="#7391a3" fontSize="10">
            УРОВНИ РЫНОЧНОЙ ЗРЕЛОСТИ
          </text>
          <line x1="612" y1="270" x2="646" y2="280" stroke="#aec7d7" />
        </svg>
        <div className="radar-caption">
          <MoveUpRight size={15} />
          <span>
            Подложка подготовлена. Отображение и выбор сценариев — в следующей
            итерации.
          </span>
        </div>
      </div>
      <div className="radar-bottom">
        <div className="legend">
          <span>
            <i className="legend-dot blue" /> Реализуется
          </span>
          <span>
            <i className="legend-dot orange" /> Не реализуется
          </span>
        </div>
        <span className="muted">Без точек и расчётных показателей</span>
      </div>
    </section>
  );
}
