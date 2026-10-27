import Link from "next/link";
import { Search, SlidersHorizontal, RotateCcw } from "lucide-react";
import type { ScenarioQuery } from "@/domain/scenario";
import type { getReferences } from "@/server/scenarios";
export function ScenarioFilters({
  query,
  references,
}: {
  query: ScenarioQuery;
  references: Awaited<ReturnType<typeof getReferences>>;
}) {
  return (
    <form
      action="/scenarios"
      className="filter-panel surface"
      aria-label="Поиск и фильтрация сценариев"
    >
      <div className="filter-topline">
        <span>
          <SlidersHorizontal size={15} /> Настройте выборку
        </span>
        <Link href="/scenarios" className="reset-link">
          <RotateCcw size={12} /> Сбросить
        </Link>
      </div>
      <div className="filter-grid">
        <label className="search-field">
          <span>ПОИСК СЦЕНАРИЯ</span>
          <div className="input-wrap">
            <Search size={16} />
            <input
              name="q"
              defaultValue={query.q}
              placeholder="Название, описание или ID"
              maxLength={200}
            />
          </div>
        </label>
        <label>
          <span>ТЕХНОЛОГИЧЕСКОЕ НАПРАВЛЕНИЕ</span>
          <select name="directionId" defaultValue={query.directionId ?? ""}>
            <option value="">Все направления</option>
            {references.directions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>БИЗНЕС-ПРОЦЕСС</span>
          <select
            name="businessNodeId"
            defaultValue={query.businessNodeId ?? ""}
          >
            <option value="">Все процессы</option>
            {references.business
              .filter((d) => d.kind === "process")
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>РЫНОЧНАЯ ЗРЕЛОСТЬ</span>
          <select name="maturity" defaultValue={query.maturity ?? ""}>
            <option value="">Все уровни</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} из 5
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>РЕАЛИЗАЦИЯ</span>
          <select
            name="implementation"
            defaultValue={query.implementation ?? ""}
          >
            <option value="">Все статусы</option>
            <option value="yes">Реализуется</option>
            <option value="no">Не реализуется</option>
            <option value="unknown">Неизвестно</option>
          </select>
        </label>
        <button className="button primary filter-submit" type="submit">
          <Search size={15} /> Найти
        </button>
      </div>
      <input type="hidden" name="context" value={query.context} />
      {query.functionalGroupId && (
        <input
          type="hidden"
          name="functionalGroupId"
          value={query.functionalGroupId}
        />
      )}
      {query.readiness && (
        <input type="hidden" name="readiness" value={query.readiness} />
      )}
      {query.impact && (
        <input type="hidden" name="impact" value={query.impact} />
      )}
      <input type="hidden" name="pageSize" value={query.pageSize} />
    </form>
  );
}
