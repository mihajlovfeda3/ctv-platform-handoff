import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getBusinessData } from "@/server/business";
import { ImplementationStatus } from "@/features/scenarios/implementation-status";
import { cardHref, workspaceHref } from "@/features/scenarios/navigation";
import {
  businessViews,
  businessQuery,
  businessHref,
  taskHref,
  type BusinessView,
  type BusinessQuery,
  type BusinessScenario,
  type Task,
} from "./model";
import styles from "./business.module.css";
type Index = Awaited<ReturnType<typeof getBusinessData>>;
type Params = Promise<Record<string, string | string[] | undefined>>;
const number = (n: number) => n.toLocaleString("ru-RU");
function Badge({
  index,
  task,
  direction,
  process,
}: {
  index: Index;
  task: Task;
  direction?: string;
  process?: string;
}) {
  const status = index.status(task.id, direction, process);
  return (
    <span className={styles.badge} data-state={status}>
      {status}
    </span>
  );
}
function Criteria() {
  return (
    <details className={styles.criteria}>
      <summary>Как рассчитывается покрытие</summary>
      <p>
        <b>Есть реализация:</b> хотя бы один связанный сценарий реализуется.{" "}
        <b>Потенциал:</b> сценарии есть, подтверждённой реализации нет.{" "}
        <b>Нет данных:</b> связанных сценариев нет. Это категории покрытия
        задач, а не дополнительные статусы сценария.
      </p>
      <p>
        Доля классов задач с реализуемыми сценариями — такие классы / все
        известные классы в выбранной функции или процессе. Это характеристика
        имеющихся связей, а не доля решённых задач или официальная оценка
        цифровизации компании. В ячейке учитывается только выбранное
        технологическое направление. Уникальные ID исключают двойной подсчёт.
      </p>
      <p>
        Недостаточно данных для сравнительной оценки зон роста и успеха:
        отраслевой уровень решения задач не задан. Внутренние статусы и внешние
        кейсы не заменяют такую оценку.
      </p>
    </details>
  );
}
function Stats({ index, process }: { index: Index; process?: string }) {
  const d = index.summary(process);
  return (
    <div className={styles.stats}>
      {[
        ["Классы задач", d.tasks.length],
        ["С реализацией", d.implementedTasks.length],
        ["Сценарии", d.scenarios.length],
        ["Реализуется", d.implemented.length],
      ].map(([label, value]) => (
        <div key={label}>
          <strong>{number(Number(value))}</strong>
          <span>{label}</span>
        </div>
      ))}
      <div>
        <strong>
          {d.share === null ? "—" : `${Math.round(d.share * 100)}%`}
        </strong>
        <span>
          Доля классов задач с реализуемыми сценариями ·{" "}
          {d.implementedTasks.length} / {d.tasks.length}
        </span>
      </div>
    </div>
  );
}
function Filters({
  view,
  q,
  index,
}: {
  view: BusinessView;
  q: BusinessQuery;
  index: Index;
}) {
  return (
    <form
      method="get"
      action={`/business/${view}`}
      className={styles.filters}
      aria-label="Фильтры бизнеса и задач"
    >
      <input type="hidden" name="context" value={q.context} />
      {view === "tasks" && (
        <label>
          Поиск
          <input
            name="q"
            defaultValue={q.q}
            placeholder="Название или описание класса"
          />
        </label>
      )}
      <label>
        ФГ / бизнес-процесс
        <select name="process" defaultValue={q.process ?? ""}>
          <option value="">Все функциональные группы и процессы</option>
          {index.facts.processes.map((p) => (
            <option key={p.id} value={p.id}>
              {"— ".repeat(Math.max(0, index.ancestors(p.id).length - 1))}
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Технологическое направление
        <select name="direction" defaultValue={q.direction ?? ""}>
          <option value="">Все направления</option>
          {index.facts.directions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        {view === "coverage" ? "Реализация сценариев" : "Реализация у задач"}
        <select name="implementation" defaultValue={q.implementation}>
          <option value="all">
            {view === "coverage" ? "Все сценарии" : "Все классы задач"}
          </option>
          <option value="yes">
            {view === "coverage" ? "Реализуется" : "Есть реализация"}
          </option>
          <option value="no">
            {view === "coverage"
              ? "Не реализуется"
              : "Без подтверждённой реализации"}
          </option>
        </select>
      </label>
      {view === "tasks" && (
        <>
          <input type="hidden" name="sort" value={q.sort} />
          <input type="hidden" name="order" value={q.order} />
        </>
      )}
      <div className={styles.filterActions}>
        <button type="submit">Применить</button>
        <Link href={`/business/${view}`}>Сбросить</Link>
      </div>
    </form>
  );
}
function TaskLinks({
  index,
  tasks,
  view,
  q,
  direction,
}: {
  index: Index;
  tasks: Task[];
  view: BusinessView;
  q: BusinessQuery;
  direction?: string;
}) {
  return (
    <ul className={styles.taskList}>
      {tasks.map((t) => (
        <li key={t.id}>
          <Link href={taskHref(t.id, view, q)}>{t.name}</Link>
          <Badge
            index={index}
            task={t}
            direction={direction ?? q.direction}
            process={q.cell ?? q.process}
          />
          <span>
            {
              index.forTask(t.id, direction ?? q.direction, q.cell ?? q.process)
                .length
            }{" "}
            сценариев
          </span>
        </li>
      ))}
    </ul>
  );
}
function ScenarioList({
  index,
  rows,
  context,
}: {
  index: Index;
  rows: BusinessScenario[];
  context: string;
}) {
  return (
    <>
      <p className={styles.note}>
        Карточки сценариев открываются в новой вкладке, сохраняя контекст
        раздела.
      </p>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Сценарий</th>
              <th>Реализация</th>
              <th>РЗ / 5</th>
              <th>ОГ / 7</th>
              <th>Влияние / 3</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const score = (metric: string) =>
                index.facts.scores.find(
                  (a) => a.scenarioId === row.id && a.metric === metric,
                )?.value ?? "—";
              return (
                <tr key={row.id}>
                  <td>
                    <Link
                      target="_blank"
                      rel="noreferrer"
                      href={cardHref(row.id, "catalog", { context })}
                    >
                      {row.name} ↗
                    </Link>
                  </td>
                  <td>
                    <ImplementationStatus value={row.implementation} />
                  </td>
                  <td>{score("market_maturity")}</td>
                  <td>{score("organizational_readiness")}</td>
                  <td>{score("business_impact")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p className={styles.empty}>
            Связанных сценариев пока нет. Оценки не подставляются
            предположительно.
          </p>
        )}
      </div>
    </>
  );
}
function Breadcrumbs({
  index,
  q,
  view,
}: {
  index: Index;
  q: BusinessQuery;
  view: BusinessView;
}) {
  return (
    <nav className={styles.breadcrumbs} aria-label="Иерархия бизнес-процессов">
      <Link
        href={businessHref(view, q, {
          process: undefined,
          cell: undefined,
          cellDirection: undefined,
        })}
      >
        Весь бизнес-ландшафт
      </Link>
      {q.process &&
        index.ancestors(q.process).map((p) => (
          <span key={p.id}>
            {" "}
            /{" "}
            <Link href={businessHref(view, q, { process: p.id })}>
              {p.name}
            </Link>
          </span>
        ))}
    </nav>
  );
}
function Landscape({ index, q }: { index: Index; q: BusinessQuery }) {
  const selected = index.facts.processes.find((p) => p.id === q.process);
  const ancestors = new Set(
    q.process ? index.ancestors(q.process).map((p) => p.id) : [],
  );
  const roots = index.facts.processes.filter(
    (p) =>
      !p.parentId ||
      !index.facts.processes.some((other) => other.id === p.parentId),
  );
  function tree(
    parent: typeof roots,
    visited: Set<string>,
    depth = 0,
  ): React.ReactNode {
    return (
      <ul className={styles.tree}>
        {parent.map((p) => {
          if (visited.has(p.id)) return null;
          const seen = new Set([...visited, p.id]);
          const children = index.facts.processes.filter(
            (c) => c.parentId === p.id,
          );
          const link = (
            <Link
              data-business-scenarios={index.summary(p.id).scenarios.length}
              aria-current={q.process === p.id ? "page" : undefined}
              href={businessHref("landscape", q, { process: p.id })}
            >
              {p.name}
              <small>
                {index.summary(p.id).tasks.length} классов ·{" "}
                {index.summary(p.id).scenarios.length} сценариев
              </small>
            </Link>
          );
          return (
            <li key={p.id}>
              {children.length ? (
                <details open={ancestors.has(p.id) || depth === 0}>
                  <summary>
                    <span>{p.name}</span>
                  </summary>
                  <div className={styles.selectProcess}>{link}</div>
                  {tree(children, seen, depth + 1)}
                </details>
              ) : (
                link
              )}
            </li>
          );
        })}
      </ul>
    );
  }
  const tasks = index.matchingTasks(q);
  const children = index.facts.processes.filter(
    (p) => p.parentId === (q.process ?? null),
  );
  const rows = index
    .summary(q.process)
    .scenarios.filter(
      (s) =>
        !q.direction ||
        index.facts.directionLinks.some(
          (d) => d.scenarioId === s.id && d.id === q.direction,
        ),
    );
  return (
    <div className={styles.landscape}>
      <aside className={styles.panel}>
        <h2>Функциональные группы и процессы</h2>
        {roots.length ? (
          tree(roots, new Set())
        ) : (
          <p>Бизнес-процессы не загружены.</p>
        )}
        <p className={styles.note}>
          Функциональные группы взяты из бизнес-контекста сценариев. Конкретные
          процессы — следующий уровень; организационные блоки сюда не входят.
        </p>
      </aside>
      <section className={styles.panel}>
        <Breadcrumbs index={index} q={q} view="landscape" />
        <h2>{selected?.name ?? "Все функциональные группы"}</h2>
        {selected?.description && <p>{selected.description}</p>}
        <p className={styles.note}>
          Сводка процесса по всем известным классам задач, до применения
          фильтров.
        </p>
        <Stats index={index} process={q.process} />
        {children.length > 0 && (
          <>
            <h3>Функции и процессы</h3>
            <div className={styles.children}>
              {children.map((p) => (
                <Link
                  key={p.id}
                  href={businessHref("landscape", q, { process: p.id })}
                >
                  {p.name}
                  <span>{index.summary(p.id).tasks.length} классов задач</span>
                </Link>
              ))}
            </div>
          </>
        )}
        <div className={styles.actions}>
          <Link href={businessHref("tasks", q)}>Открыть классы задач</Link>
          <Link href={businessHref("coverage", q)}>Матрица покрытия →</Link>
          {(selected?.sourceProcessId || selected?.functionalGroupId) && (
            <Link
              href={workspaceHref("catalog", {
                businessNodeId: selected?.sourceProcessId,
                functionalGroupId: selected?.functionalGroupId,
                context: q.context,
              })}
            >
              Связанные сценарии в каталоге ↗
            </Link>
          )}
        </div>
        <h3>Классы задач · {tasks.length}</h3>
        {tasks.length ? (
          <TaskLinks index={index} tasks={tasks} view="landscape" q={q} />
        ) : (
          <p className={styles.empty}>
            В этом контексте классы задач не найдены.
          </p>
        )}
        <details className={styles.disclosure}>
          <summary>Связанные сценарии · {rows.length}</summary>
          <ScenarioList index={index} rows={rows} context={q.context} />
        </details>
      </section>
    </div>
  );
}
function Tasks({ index, q }: { index: Index; q: BusinessQuery }) {
  const tasks = index.matchingTasks(q);
  tasks.sort((a, b) => {
    const av =
      q.sort === "name"
        ? a.name
        : q.sort === "scenarios"
          ? index.forTask(a.id, q.direction, q.process).length
          : index
              .forTask(a.id, q.direction, q.process)
              .filter((s) => s.implementation === "yes").length;
    const bv =
      q.sort === "name"
        ? b.name
        : q.sort === "scenarios"
          ? index.forTask(b.id, q.direction, q.process).length
          : index
              .forTask(b.id, q.direction, q.process)
              .filter((s) => s.implementation === "yes").length;
    const comparison =
      typeof av === "string"
        ? av.localeCompare(String(bv), "ru")
        : av - Number(bv);
    return (
      (q.order === "desc" ? -1 : 1) * comparison || a.id.localeCompare(b.id)
    );
  });
  const sort = (key: BusinessQuery["sort"], title: string) => (
    <Link
      href={businessHref("tasks", q, {
        sort: key,
        order: q.sort === key && q.order === "asc" ? "desc" : "asc",
      })}
    >
      {title}
      {q.sort === key ? (q.order === "asc" ? " ↑" : " ↓") : ""}
    </Link>
  );
  return (
    <section className={styles.panel}>
      <div className={styles.sectionHeading}>
        <h2>Классы задач</h2>
        <span>Найдено {number(tasks.length)}</span>
      </div>
      <p className={styles.note}>
        Класс задачи — рычаг влияния + процесс + объект. Названия и описания
        приведены из действующего справочника.
      </p>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th
                aria-sort={
                  q.sort === "name"
                    ? q.order === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                {sort("name", "Класс задачи")}
              </th>
              <th>Функциональная группа / процесс</th>
              <th>{sort("scenarios", "Сценарии")}</th>
              <th>{sort("implemented", "Реализуется")}</th>
              <th>Покрытие</th>
              <th>Типы эффектов</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const rows = index.forTask(t.id, q.direction, q.process);
              return (
                <tr key={t.id}>
                  <td>
                    <Link href={taskHref(t.id, "tasks", q)}>{t.name}</Link>
                    {t.description && (
                      <p className={styles.rowDescription}>{t.description}</p>
                    )}
                  </td>
                  <td>
                    {index.taskContexts(t.id).map((p) => (
                      <div key={p.id}>
                        {index
                          .ancestors(p.id)
                          .map((node) => node.name)
                          .join(" → ")}
                      </div>
                    ))}
                    {!index.taskContexts(t.id).length &&
                      "Функциональная группа не определена"}
                  </td>
                  <td>{rows.length}</td>
                  <td>
                    {rows.filter((s) => s.implementation === "yes").length}
                  </td>
                  <td>
                    <Badge
                      index={index}
                      task={t}
                      direction={q.direction}
                      process={q.process}
                    />
                  </td>
                  <td>
                    {index
                      .effectsFor(rows)
                      .map((e) => e.name)
                      .join(", ") || "Не указаны"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!tasks.length && (
        <div className={styles.empty}>
          <h3>Классы задач не найдены</h3>
          <p>
            Попробуйте другой запрос или сбросьте фильтры. Отсутствие связей не
            означает отсутствие возможности применения ЦТ.
          </p>
          <Link href="/business/tasks">Сбросить фильтры</Link>
        </div>
      )}
    </section>
  );
}
function Coverage({ index, q }: { index: Index; q: BusinessQuery }) {
  const children = index.facts.processes.filter(
    (p) => p.parentId === (q.process ?? null),
  );
  const selected = index.facts.processes.find((p) => p.id === q.process);
  const rows = children.length ? children : selected ? [selected] : [];
  const directions = index.facts.directions.filter(
    (d) => !q.direction || d.id === q.direction,
  );
  const filtered = q.q
    ? new Set(index.matchingTasks({ q: q.q }).map((t) => t.id))
    : undefined;
  const summarize = (process?: string, direction = q.direction) =>
    index.summary(process, direction, filtered, q.implementation);
  const cells = rows.map((p) => directions.map((d) => summarize(p.id, d.id)));
  const max = Math.max(1, ...cells.flat().map((c) => c.scenarios.length));
  const totals = directions.map((d) => summarize(q.process, d.id));
  const grand = summarize(q.process);
  const cellProcess = rows.find((p) => p.id === q.cell);
  const cellDirection = directions.find((d) => d.id === q.cellDirection);
  const detail =
    cellProcess && cellDirection
      ? summarize(cellProcess.id, cellDirection.id)
      : null;
  return (
    <>
      <section className={styles.panel}>
        <Breadcrumbs index={index} q={q} view="coverage" />
        <div className={styles.sectionHeading}>
          <h2>Функции × технологические направления</h2>
          <span>
            {rows.length} функций / процессов · {directions.length} направлений
          </span>
        </div>
        <p className={styles.note}>
          Строки — ФГ или их процессы. Насыщенность — число уникальных связанных
          сценариев, шкала относительно текущей таблицы. Число в ячейке —
          сценарии; раскрытие показывает состав.
        </p>
        <div className={styles.legend}>
          <span>
            <i /> 0 — нет сценариев
          </span>
          <span>
            <i data-level="1" /> Низкая интенсивность: до ⅓ максимума
          </span>
          <span>
            <i data-level="3" /> Высокая: свыше ⅔; максимум {max} сценариев
          </span>
        </div>
        <div className={styles.heatScroll}>
          <table className={styles.heatmap}>
            <thead>
              <tr>
                <th>Функция / направление</th>
                {directions.map((d) => (
                  <th key={d.id}>{d.name}</th>
                ))}
                <th>Уникальный итог</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.id}>
                  <th>
                    <Link href={businessHref("coverage", q, { process: p.id })}>
                      {p.name}
                    </Link>
                    {index.facts.processes.some((c) => c.parentId === p.id) && (
                      <small>Перейти к дочерним процессам ↓</small>
                    )}
                  </th>
                  {directions.map((d, j) => {
                    const c = cells[i][j];
                    const level = c.scenarios.length
                      ? Math.max(1, Math.ceil((3 * c.scenarios.length) / max))
                      : 0;
                    return (
                      <td key={d.id}>
                        <Link
                          data-coverage-cell
                          data-missing={p.missingClassification || undefined}
                          data-level={level}
                          aria-current={
                            q.cell === p.id && q.cellDirection === d.id
                              ? "page"
                              : undefined
                          }
                          title={`${p.name} / ${d.name}: ${c.covered.length} классов задач, ${c.scenarios.length} сценариев, ${c.implemented.length} реализуется`}
                          href={businessHref("coverage", q, {
                            cell: p.id,
                            cellDirection: d.id,
                          })}
                        >
                          <strong>
                            {c.scenarios.length ||
                              (p.missingClassification ? "?" : "0")}
                          </strong>
                          <span>{c.implemented.length} реализуется</span>
                        </Link>
                      </td>
                    );
                  })}
                  <td className={styles.total}>
                    {summarize(p.id).scenarios.length}
                    <small>
                      {summarize(p.id).implemented.length} реализуется
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Уникальный итог</th>
                {totals.map((t, i) => (
                  <td className={styles.total} key={directions[i].id}>
                    {t.scenarios.length}
                    <small>{t.implemented.length} реализуется</small>
                  </td>
                ))}
                <td className={styles.total}>
                  {grand.scenarios.length}
                  <small>{grand.implemented.length} реализуется</small>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className={styles.note}>
          Итоги считают уникальные сценарии, а не сумму пересекающихся ячеек.
          Сценарии без технологической классификации входят в итог, но не в
          столбцы направлений. «?» и пунктир обозначают неизвестную
          функциональную классификацию; «0» в остальных строках — отсутствие
          сценариев.
        </p>
        {!rows.length && (
          <p className={styles.empty}>
            Бизнес-процессы отсутствуют. Покрытие пока нельзя рассчитать.
          </p>
        )}
        {!directions.length && (
          <p className={styles.empty}>
            В справочнике нет подходящих технологических направлений.
          </p>
        )}
      </section>
      {detail && (
        <section className={styles.panel} aria-label="Состав ячейки">
          <div className={styles.sectionHeading}>
            <h2>
              {cellProcess!.name} · {cellDirection!.name}
            </h2>
            <Link href={businessHref("coverage", q)}>Закрыть</Link>
          </div>
          <p>
            {detail.covered.length} классов задач · {detail.scenarios.length}{" "}
            сценариев · {detail.implemented.length} реализуется
          </p>
          <h3>Классы задач</h3>
          {detail.covered.length ? (
            <TaskLinks
              index={index}
              tasks={detail.covered}
              view="coverage"
              direction={cellDirection!.id}
              q={{
                ...q,
                cell: cellProcess!.id,
                cellDirection: cellDirection!.id,
              }}
            />
          ) : (
            <p className={styles.empty}>
              Связанные классы задач для этой ячейки не указаны.
            </p>
          )}
          <h3>Сценарии</h3>
          <ScenarioList
            index={index}
            rows={detail.scenarios}
            context={q.context}
          />
        </section>
      )}
    </>
  );
}
export async function BusinessWorkspace({
  view,
  searchParams,
}: {
  view: BusinessView;
  searchParams: Params;
}) {
  const parsed = businessQuery.safeParse(
    Object.fromEntries(
      Object.entries(await searchParams).filter(([, v]) => v !== ""),
    ),
  );
  if (!parsed.success)
    return (
      <div className={styles.page}>
        <h1>Некорректные параметры фильтра</h1>
        <Link href={`/business/${view}`}>Сбросить параметры</Link>
      </div>
    );
  const q = parsed.data;
  const index = await getBusinessData(q.context);
  if (q.process && !index.facts.processes.some((p) => p.id === q.process))
    return (
      <div className={styles.page}>
        <h1>Процесс не найден</h1>
        <Link href={`/business/${view}`}>Вернуться к бизнес-ландшафту</Link>
      </div>
    );
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <h1>{businessViews[view]}</h1>
        <p>Бизнес и задачи · от процессов к сценариям применения ЦТ</p>
      </header>
      <nav className={styles.tabs} aria-label="Представления бизнеса и задач">
        {Object.entries(businessViews).map(([key, title]) => (
          <Link
            key={key}
            aria-current={key === view ? "page" : undefined}
            href={businessHref(key as BusinessView, q)}
          >
            {title}
          </Link>
        ))}
      </nav>
      <Filters key={JSON.stringify(q)} view={view} q={q} index={index} />
      <p className={styles.note}>
        {
          index.facts.processes.filter(
            (p) => p.functionalGroupId && !p.parentId,
          ).length
        }{" "}
        функциональных групп · {index.facts.tasks.length} классов задач, из них{" "}
        {index.facts.tasks.filter((t) => t.isSynthetic).length} синтетических.
        Показаны существующие связи, без достроения отсутствующих данных.
      </p>
      <details className={styles.criteria}>
        <summary>Ограничения демонстрационных данных</summary>
        <p>
          Связи демонстрационных классов созданы из повторяющихся профилей
          генератора и не подтверждают корпоративную классификацию. Они
          сохранены без перераспределения; новые связи не добавлялись.
        </p>
      </details>
      <Criteria />
      {view === "landscape" ? (
        <Landscape index={index} q={q} />
      ) : view === "tasks" ? (
        <Tasks index={index} q={q} />
      ) : (
        <>
          <p className={styles.note}>
            Сводка процесса по всем известным классам задач, до применения
            фильтров.
          </p>
          <Stats index={index} process={q.process} />
          <Coverage index={index} q={q} />
        </>
      )}
    </div>
  );
}
export async function TaskCard({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Params;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const parsed = businessQuery.safeParse(
    Object.fromEntries(
      Object.entries(await searchParams).filter(([, v]) => v !== ""),
    ),
  );
  const q = parsed.success ? parsed.data : businessQuery.parse({});
  const index = await getBusinessData(q.context);
  const task = index.facts.tasks.find((t) => t.id === id);
  if (!task) notFound();
  const scenarios = index.forTask(id);
  const effects = index.effectsFor(scenarios);
  const cases = index.casesFor(scenarios);
  return (
    <div className={styles.page}>
      <Link
        className={styles.back}
        href={businessHref(q.from, q, {
          cell: q.cell,
          cellDirection: q.cellDirection,
        })}
      >
        ← Вернуться к представлению «{businessViews[q.from]}»
      </Link>
      <header className={styles.taskHero}>
        <span className={styles.eyebrow}>Класс задачи</span>
        <h1>{task.name}</h1>
        {task.description?.trim() && <p>{task.description}</p>}
        <Badge index={index} task={task} />
        <div className={styles.summary}>
          <span>{scenarios.length} сценариев</span>
          <span>
            {scenarios.filter((s) => s.implementation === "yes").length}{" "}
            реализуется
          </span>
        </div>
      </header>
      <section className={styles.panel}>
        <h2>Бизнес-контекст</h2>
        {index.taskContexts(task.id).length ? (
          index
            .taskContexts(task.id)
            .map((p) => (
              <Breadcrumbs
                key={p.id}
                index={index}
                q={{ ...q, process: p.id }}
                view="landscape"
              />
            ))
        ) : (
          <p>Функциональная группа не определена.</p>
        )}
      </section>
      <section className={styles.panel}>
        <h2>Связанные сценарии</h2>
        <ScenarioList index={index} rows={scenarios} context={q.context} />
      </section>
      <section className={styles.panel}>
        <h2>Технологические направления и эффекты</h2>
        <ul className={styles.chips}>
          {index.facts.directions
            .filter((d) =>
              index.facts.directionLinks.some(
                (l) =>
                  l.id === d.id && scenarios.some((s) => s.id === l.scenarioId),
              ),
            )
            .map((d) => (
              <li key={d.id}>{d.name}</li>
            ))}
        </ul>
        <h3>Типы эффектов</h3>
        {effects.length ? (
          <ul className={styles.chips}>
            {effects.map((e) => (
              <li key={e.id}>{e.name}</li>
            ))}
          </ul>
        ) : (
          <p>Типы эффектов у связанных сценариев не указаны.</p>
        )}
      </section>
      <section className={styles.panel}>
        <h2>Кейсы бенчмаркинга</h2>
        <p className={styles.note}>
          Внешние кейсы не подтверждают реализацию внутри компании. Недостаточно
          данных для сравнительной оценки зон роста и успеха.
        </p>
        {cases.length ? (
          <ul className={styles.cases}>
            {cases.map((c) => (
              <li key={c.id}>
                <h3>{c.name}</h3>
                <p>{c.description || "Описание не указано"}</p>
                <small>
                  {c.implementationYear
                    ? `Год: ${c.implementationYear} · `
                    : ""}
                  {c.isSynthetic
                    ? "Синтетический учебный кейс"
                    : "Кейс из справочника"}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p>Через связанные сценарии кейсы бенчмаркинга пока не добавлены.</p>
        )}
      </section>
      <details className={`${styles.panel} ${styles.disclosure}`}>
        <summary>Техническая информация и происхождение</summary>
        <dl className={styles.metadata}>
          <dt>Контекст оценок</dt>
          <dd>{q.context}</dd>
          <dt>ID класса</dt>
          <dd>{task.id}</dd>
          <dt>Происхождение</dt>
          <dd>
            {task.isSynthetic ? "Синтетическая запись" : "Запись справочника"}
          </dd>
          <dt>Источник</dt>
          <dd>
            {index.facts.sources.find((s) => s.id === task.sourceId)?.name ??
              "Не указан"}
          </dd>
        </dl>
      </details>
      <Criteria />
    </div>
  );
}
