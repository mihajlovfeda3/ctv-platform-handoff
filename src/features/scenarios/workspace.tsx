import { ContextLink as Link } from "./camera-context";
import { RestoreWorkspaceScroll } from "./scroll-context";
import { workspaceQuery } from "./filter-state";
import {
  getReferences,
  listScenarios,
  getScenario,
  relatedObjects,
} from "@/server/scenarios";
import { ScenarioFilters } from "./filters";
import { ScenarioCatalog } from "./catalog";
import { Inspector } from "./inspector";
import { AnalyticsView } from "./analytics-view";
import { scenarioAnalytics } from "@/server/analytics";
import {
  views,
  workspaceHref,
  cardHref,
  type ScenarioView,
} from "./navigation";
export async function Workspace({
  view,
  searchParams,
}: {
  view: ScenarioView;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = workspaceQuery(await searchParams);
  if (!parsed)
    return (
      <div className="page surface empty-state">
        <h1>Некорректные параметры фильтра</h1>
        <p>Проверьте диапазоны оценок и идентификаторы.</p>
        <Link href={`/scenarios/${view}`} className="button">
          Сбросить параметры
        </Link>
      </div>
    );
  const query = parsed.query;
  const [result, references, item, analytics] = await Promise.all([
    listScenarios(query),
    getReferences(),
    query.selected ? getScenario(query.selected) : null,
    view === "catalog" ? null : scenarioAnalytics(query),
  ]);
  const related = item ? await relatedObjects(item.scenario.id) : null;
  return (
    <div
      className={`page scenarios-page ${view === "catalog" ? "catalog-page" : view === "radar" ? "radar-page" : ""}`}
    >
      <RestoreWorkspaceScroll href={workspaceHref(view, query)} />
      <header className="scenario-heading">
        <h1>{view === "catalog" ? "Каталог сценариев" : views[view]}</h1>
      </header>
      <nav className="scenario-tabs" aria-label="Представления сценариев">
        {Object.entries(views).map(([key, title]) => (
          <Link
            key={key}
            href={workspaceHref(key as ScenarioView, query)}
            aria-current={view === key ? "page" : undefined}
          >
            {title}
          </Link>
        ))}
      </nav>
      <ScenarioFilters
        query={query}
        references={references}
        view={view}
        invalidDraft={parsed.invalidDraft}
      />
      <div className="scenario-workspace" key={view}>
        {view === "catalog" ? (
          <ScenarioCatalog
            result={result}
            query={query}
            businessDirections={references.businessDirections}
          />
        ) : (
          <>
            <section className="surface analytical-stage">
              <div className="analytical-heading">
                <div>
                  {view !== "radar" && <h2>{views[view]}</h2>}
                  <p>
                    {view === "radar"
                      ? "Рыночная зрелость 1–5 · технологические направления"
                      : "Рыночная зрелость × организационная готовность"}
                  </p>
                </div>
                {view === "radar" && (
                  <div
                    className="density-switch"
                    aria-label="Плотность визуализации"
                  >
                    {(["points", "groups"] as const).map((mode) => (
                      <Link
                        replace
                        scroll={false}
                        key={mode}
                        href={workspaceHref(view, query, { mode })}
                        aria-current={query.mode === mode ? "true" : undefined}
                      >
                        {mode === "groups" ? "Группы" : "Точки"}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {analytics && (
                <AnalyticsView data={analytics} query={query} view={view} />
              )}
            </section>
            <details className="surface quick-scenarios">
              <summary>
                Сценарии текущей выборки{" "}
                <span>Быстрый просмотр · {result.total}</span>
              </summary>
              <div className="quick-grid">
                {result.items.slice(0, 6).map((row) => (
                  <Link
                    key={row.id}
                    href={workspaceHref(view, query, { selected: row.id })}
                    scroll={false}
                  >
                    <strong>{row.name}</strong>
                    <small>
                      {row.externalId} · {row.business}
                    </small>
                  </Link>
                ))}
                {!result.items.length && (
                  <p>Сценарии не найдены. Измените фильтры.</p>
                )}
              </div>
              <Link
                className="quick-all"
                href={workspaceHref("catalog", query)}
              >
                Весь каталог →
              </Link>
            </details>
          </>
        )}
        {item && related && (
          <Inspector
            key={item.scenario.id}
            item={item}
            related={related}
            context={query.context}
            variant={
              view === "catalog"
                ? "catalog"
                : view === "radar"
                  ? "radar"
                  : undefined
            }
            closeHref={workspaceHref(view, query, { selected: undefined })}
            fullHref={cardHref(item.scenario.id, view, query)}
          />
        )}
        {query.selected && !item && (
          <div className="selection-warning">
            Выбранный сценарий не найден.{" "}
            <Link href={workspaceHref(view, query, { selected: undefined })}>
              Закрыть выбор
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
