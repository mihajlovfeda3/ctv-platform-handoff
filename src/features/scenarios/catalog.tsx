"use client";
import { ContextLink as Link } from "./camera-context";
import { CardLink } from "./scroll-context";
import { workspaceHref, cardHref } from "./navigation";
import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { cameraHref } from "./camera-context";
import { Select } from "@/components/select";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  SearchX,
} from "lucide-react";
import type { ScenarioList } from "@/server/scenarios";
import { implementationLabels, type ScenarioQuery } from "@/domain/scenario";
const subscribe = () => () => {};
export function ScenarioCatalog({
  result,
  query,
}: {
  result: ScenarioList;
  query: ScenarioQuery;
}) {
  const router = useRouter();
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const href = (patch: Record<string, string | number | undefined>) =>
    workspaceHref("catalog", query, patch);
  const select = (id: string) =>
    router.replace(cameraHref(href({ selected: id }), window.location.search), {
      scroll: false,
    });
  const sort = (key: Exclude<ScenarioQuery["sort"], "id">, label: string) => (
    <Link
      replace
      scroll={false}
      aria-label={`Сортировать: ${label}`}
      href={href({
        sort: key,
        order: query.sort === key && query.order === "asc" ? "desc" : "asc",
        page: 1,
      })}
    >
      {label}
      {query.sort === key ? (
        query.order === "asc" ? (
          <ArrowUp size={13} />
        ) : (
          <ArrowDown size={13} />
        )
      ) : null}
    </Link>
  );
  const ariaSort = (key: string) =>
    query.sort === key
      ? query.order === "asc"
        ? "ascending"
        : "descending"
      : "none";
  return (
    <section
      className="surface catalog catalog-refined"
      aria-label="Каталог сценариев"
      aria-busy={!ready}
    >
      <div className="catalog-heading">
        <span className="catalog-count" aria-live="polite">
          Найдено <strong>{result.total.toLocaleString("ru-RU")}</strong>{" "}
          сценариев
        </span>
      </div>
      {!result.items.length ? (
        <div className="empty-state">
          <SearchX size={28} />
          <h3>
            {result.total ? "Страница вне диапазона" : "Сценарии не найдены"}
          </h3>
          <p>
            {result.total
              ? "Вернитесь на первую страницу выборки."
              : "Попробуйте изменить поиск или снять ограничения."}
          </p>
          <Link
            className="button"
            href={
              result.total
                ? href({ page: 1 })
                : workspaceHref("catalog", {
                    context: query.context,
                    pageSize: query.pageSize,
                  })
            }
          >
            {result.total ? "Первая страница" : "Сбросить фильтры"}
          </Link>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="scenario-table" aria-label="Сценарии применения">
            <thead>
              <tr>
                <th aria-sort={ariaSort("name")}>{sort("name", "Название")}</th>
                <th aria-sort={ariaSort("maturity")}>
                  {sort("maturity", "РЗ")}
                </th>
                <th aria-sort={ariaSort("readiness")}>
                  {sort("readiness", "ОГ")}
                </th>
                <th aria-sort={ariaSort("impact")}>
                  {sort("impact", "Влияние на бизнес-цели")}
                </th>
                <th>Статус реализации</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item, index) => {
                const value = (metric: string, max: number) => {
                  const v = item.assessments.find(
                    (a) => a.metric === metric,
                  )?.value;
                  return v == null ? "—" : `${v}/${max}`;
                };
                const businessContext =
                  item.functionalGroup ??
                  (item.functionalGroupConflict || item.functionalGroupUnmapped
                    ? "Функциональная группа требует сопоставления"
                    : item.business) ??
                  "Бизнес-контекст не указан";
                return (
                  <tr
                    key={item.id}
                    tabIndex={0}
                    aria-selected={query.selected === item.id}
                    data-scenario-id={item.id}
                    onClick={(e) => {
                      if (!(e.target as HTMLElement).closest("a,button,select"))
                        select(item.id);
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.target !== e.currentTarget &&
                        !(e.target as HTMLElement).closest(".record-title")
                      )
                        return;
                      if (
                        e.key === "ArrowDown" ||
                        e.key === "ArrowUp" ||
                        e.key === "Home" ||
                        e.key === "End"
                      ) {
                        e.preventDefault();
                        const rows =
                          e.currentTarget.parentElement!.querySelectorAll<HTMLTableRowElement>(
                            "tr",
                          );
                        const next =
                          e.key === "Home"
                            ? 0
                            : e.key === "End"
                              ? rows.length - 1
                              : Math.max(
                                  0,
                                  Math.min(
                                    rows.length - 1,
                                    index + (e.key === "ArrowDown" ? 1 : -1),
                                  ),
                                );
                        rows[next].focus();
                      }
                      if (
                        (e.key === "Enter" || e.key === " ") &&
                        e.target === e.currentTarget
                      ) {
                        e.preventDefault();
                        select(item.id);
                      }
                    }}
                  >
                    <td>
                      <Link
                        className="record-title"
                        title={item.name}
                        scroll={false}
                        replace
                        href={href({ selected: item.id })}
                      >
                        {item.name}
                      </Link>
                      <div className="record-context">
                        <span title={businessContext}>{businessContext}</span>
                        <CardLink
                          className="row-card-link"
                          returnHref={href({ selected: item.id })}
                          href={cardHref(item.id, "catalog", query)}
                          aria-label={`Открыть ${item.externalId}`}
                        >
                          <ArrowUpRight size={16} />
                        </CardLink>
                      </div>
                    </td>
                    <td>{value("market_maturity", 5)}</td>
                    <td>{value("organizational_readiness", 7)}</td>
                    <td>{value("business_impact", 3)}</td>
                    <td>
                      <span className={`status ${item.implementation}`}>
                        <i />
                        {implementationLabels[item.implementation]}
                      </span>
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
            ? `${result.items.length ? (result.page - 1) * result.pageSize + 1 : 0}–${Math.min(result.page * result.pageSize, result.total)} из ${result.total}`
            : "Нет записей"}
        </span>
        <div className="page-size">
          <span>Строк на странице</span>
          <Select
            label="Строк на странице"
            value={String(query.pageSize)}
            items={Array.from(new Set([query.pageSize, 25, 50])).map((n) => ({
              id: String(n),
              name: String(n),
            }))}
            onValueChange={(value) =>
              router.replace(
                cameraHref(
                  href({ pageSize: Number(value), page: 1 }),
                  window.location.search,
                ),
                { scroll: false },
              )
            }
          />
        </div>
        <div>
          {result.page > 1 ? (
            <Link
              className="page-button"
              aria-label="Предыдущая страница"
              href={href({ page: result.page - 1 })}
            >
              <ChevronLeft size={16} />
            </Link>
          ) : (
            <button
              className="page-button"
              disabled
              aria-label="Предыдущая страница"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <span>
            {result.page} / {Math.max(1, result.pages)}
          </span>
          {result.page < result.pages ? (
            <Link
              className="page-button"
              aria-label="Следующая страница"
              href={href({ page: result.page + 1 })}
            >
              <ChevronRight size={16} />
            </Link>
          ) : (
            <button
              className="page-button"
              disabled
              aria-label="Следующая страница"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
