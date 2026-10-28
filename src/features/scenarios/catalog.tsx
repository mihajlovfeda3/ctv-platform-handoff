import { ContextLink as Link } from "./camera-context";
import { CardLink } from "./scroll-context";
import { workspaceHref, cardHref } from "./navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import type { ScenarioList } from "@/server/scenarios";
import { implementationLabels, type ScenarioQuery } from "@/domain/scenario";
export function ScenarioCatalog({
  result,
  query,
}: {
  result: ScenarioList;
  query: ScenarioQuery;
}) {
  const pageLink = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== "") params.set(key, String(value));
    params.set("page", String(page));
    return `/scenarios/catalog?${params}`;
  };
  return (
    <section className="surface catalog">
      <div className="catalog-heading">
        <div className="title-inline">
          <h2>Каталог сценариев</h2>
          <span className="count-badge">{result.total}</span>
        </div>
        <div className="catalog-sort">
          {["id", "name", "maturity", "readiness", "impact"].map((key, i) => (
            <Link
              replace
              scroll={false}
              key={key}
              href={workspaceHref("catalog", query, {
                sort: key,
                order:
                  query.sort === key && query.order === "asc" ? "desc" : "asc",
                page: undefined,
              })}
            >
              {["ID", "Название", "РЗ", "ОГ", "Влияние"][i]}
              {query.sort === key ? (query.order === "asc" ? " ↑" : " ↓") : ""}
            </Link>
          ))}
        </div>
      </div>
      {!result.items.length ? (
        <div className="empty-state">
          <SearchX size={30} />
          <h3>
            {result.total ? "Страница вне диапазона" : "Сценарии не найдены"}
          </h3>
          <p>Измените условия поиска или загрузите синтетический набор.</p>
          <Link
            href={workspaceHref("catalog", query, { page: 1 })}
            className="button"
          >
            Вернуться к каталогу
          </Link>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>СЦЕНАРИЙ / БИЗНЕС-ПРОЦЕСС</th>
                <th>РЫНОЧНАЯ ЗРЕЛОСТЬ</th>
                <th>ГОТОВНОСТЬ</th>
                <th>ВЛИЯНИЕ</th>
                <th>РЕАЛИЗАЦИЯ</th>
                <th>
                  <span className="sr-only">Открыть</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => {
                const maturity = item.assessments.find(
                  (a) => a.metric === "market_maturity",
                )?.value;
                const readiness = item.assessments.find(
                  (a) => a.metric === "organizational_readiness",
                )?.value;
                return (
                  <tr key={item.id} aria-selected={query.selected === item.id}>
                    <td>
                      <div className="record-id">
                        {item.externalId}
                        {item.isSynthetic && (
                          <span className="synthetic-label">СИНТЕТИКА</span>
                        )}
                      </div>
                      <Link
                        scroll={false}
                        className="record-title"
                        href={workspaceHref("catalog", query, {
                          selected: item.id,
                        })}
                      >
                        {item.name}
                      </Link>
                      <div className="record-process">
                        {item.business ?? "Процесс не указан"}
                      </div>
                    </td>
                    <td>
                      <div className="rating-value">
                        {maturity == null ? (
                          <span className="unknown-value">Неизвестно</span>
                        ) : (
                          <>
                            <strong>{maturity}</strong>
                            <span>/ 5</span>
                            <span className="rating-bars">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <i
                                  key={n}
                                  className={n <= maturity ? "filled" : ""}
                                />
                              ))}
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="readiness">
                        {readiness ?? "—"}
                        <small> / 7</small>
                      </span>
                    </td>
                    <td>
                      {item.assessments.find(
                        (a) => a.metric === "business_impact",
                      )?.value ?? "—"}
                      <small> / 3</small>
                    </td>
                    <td>
                      <span className={`status ${item.implementation}`}>
                        <i />
                        {implementationLabels[item.implementation]}
                      </span>
                    </td>
                    <td>
                      <CardLink
                        returnHref={workspaceHref("catalog", query, {
                          selected: item.id,
                        })}
                        href={cardHref(item.id, "catalog", query)}
                        className="row-open"
                        aria-label={`Открыть ${item.externalId}`}
                      >
                        <ArrowUpRight size={18} />
                      </CardLink>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="pagination">
        <span>
          {result.total
            ? `Показано ${result.items.length ? (result.page - 1) * result.pageSize + 1 : 0}–${Math.min(result.page * result.pageSize, result.total)} из ${result.total}`
            : "Нет записей"}
        </span>
        <div>
          {result.page > 1 && (
            <Link
              aria-label="Предыдущая страница"
              className="page-button"
              href={pageLink(result.page - 1)}
            >
              <ChevronLeft size={16} />
            </Link>
          )}
          <span>
            Страница {result.page} из {Math.max(1, result.pages)}
          </span>
          {result.page < result.pages && (
            <Link
              aria-label="Следующая страница"
              className="page-button"
              href={pageLink(result.page + 1)}
            >
              <ChevronRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
