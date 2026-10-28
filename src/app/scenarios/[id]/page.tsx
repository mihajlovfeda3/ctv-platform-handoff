import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getScenario, relatedObjects } from "@/server/scenarios";
import {
  implementationLabels,
  oodaLabels,
  scenarioQuery,
} from "@/domain/scenario";
import { workspaceHref } from "@/features/scenarios/navigation";
import { Metrics } from "@/features/scenarios/metrics";
export const dynamic = "force-dynamic";
export const metadata = { title: "Карточка сценария" };
const names = {
  market_maturity: "Рыночная зрелость",
  organizational_readiness: "Организационная готовность",
  business_impact: "Влияние на бизнес-цели",
  application_trl: "TRL применения",
  solution_potential: "Потенциал решения",
};
export default async function ScenarioDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const item = await getScenario(id);
  if (!item) notFound();
  const queryResult = scenarioQuery.safeParse(await searchParams);
  const query = queryResult.success
    ? queryResult.data
    : scenarioQuery.parse({});
  const related = await relatedObjects(id),
    s = item.scenario;
  const current = item.assessments
    .map((a) => a.assessment)
    .filter((a) => a.isCurrent && a.organizationalContext === query.context);
  const date = (d: Date) =>
    new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow" }).format(d);
  return (
    <div className="page detail-page revised-card">
      <Link
        scroll={false}
        className="back-link"
        href={workspaceHref(query.from, query)}
      >
        ← Вернуться к выборке
      </Link>
      <header className="detail-header">
        <div className="record-id">
          {s.externalId}
          <span className="tag">
            {s.isSynthetic ? "Синтетическая запись" : "Импортированная запись"}
          </span>
        </div>
        <h1>{s.name}</h1>
        <p>{s.description}</p>
        <span className={`status ${s.implementation}`}>
          <i />
          {implementationLabels[s.implementation]}
        </span>
      </header>
      <section className="surface card-context">
        <div>
          <span className="muted">Бизнес-процесс</span>
          <h3>{item.business ?? "Не указан"}</h3>
          <p>{item.functionalGroup ?? "Группа не указана"}</p>
        </div>
        <div>
          <span className="muted">Технологическая классификация</span>
          {related.technologies.map((t) => (
            <p key={t.id}>
              {t.direction} → <strong>{t.technology}</strong> → {t.name}
            </p>
          ))}
          {!related.technologies.length && <p>Не сопоставлена</p>}
        </div>
      </section>
      <Metrics assessments={current} />
      <section className="surface detail-section">
        <h2>Бизнес-контекст</h2>
        <dl>
          {[
            ["Бизнес-вызов", s.businessChallenge],
            ["Обоснование", s.rationale],
            ["Предложение проекта", s.projectProposal],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v ?? "Не указано"}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="surface detail-section linked-objects">
        <h2>Задачи, эффекты и связанные объекты</h2>
        {[
          ["Классы задач", related.tasks],
          ["Типы бизнес-эффектов", related.effects],
          ["Кейсы бенчмаркинга", related.cases],
          ["Решения поставщиков", related.solutions],
          ["Внутренние проекты", related.projects],
        ].map(([title, raw]) => {
          const rows = raw as { id: string; name: string; vendor?: string }[];
          return (
            <div key={String(title)}>
              <h3>
                {String(title)} <span>{rows.length}</span>
              </h3>
              {rows.length ? (
                <ul>
                  {rows.map((r) => (
                    <li key={r.id}>
                      {r.name}
                      {r.vendor && ` · ${r.vendor}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="muted">Связи не добавлены</span>
              )}
            </div>
          );
        })}
      </section>
      <details className="surface detail-section">
        <summary>Дополнительные характеристики и происхождение</summary>
        <dl>
          {[
            [
              "Цикл OODA",
              s.ooda ? oodaLabels[s.ooda as keyof typeof oodaLabels] : null,
            ],
            ["Технологический тренд", s.technologyTrend],
            ["Источник", item.source],
            ["UUID", s.id],
            ["Исходный ID", `${s.originNamespace} / ${s.externalId}`],
            ["Создано", date(s.createdAt)],
            ["Обновлено", date(s.updatedAt)],
            ["Контекст оценок", query.context],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v ?? "Не указано"}</dd>
            </div>
          ))}
        </dl>
      </details>
      <details className="surface detail-section">
        <summary>Все оценки, источники и история</summary>
        {Object.entries(names).map(([metric, label]) => (
          <div className="assessment-block" key={metric}>
            <h3>{label}</h3>
            {item.assessments
              .filter((a) => a.assessment.metric === metric)
              .map(({ assessment: a, source }) => (
                <div className="assessment-line" key={a.id}>
                  <strong>{a.value ?? a.qualitativeValue}</strong>
                  <div>
                    <span>
                      {a.organizationalContext} ·{" "}
                      {a.isCurrent ? "Текущая" : "Архивная"}
                    </span>
                    <small>
                      {source ?? "Источник не указан"} · {date(a.assessedAt)}
                    </small>
                  </div>
                </div>
              ))}
            {!item.assessments.some((a) => a.assessment.metric === metric) && (
              <span className="muted">Неизвестно</span>
            )}
          </div>
        ))}
      </details>
    </div>
  );
}
