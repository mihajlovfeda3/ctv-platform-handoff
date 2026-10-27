import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { getScenario, relatedObjects } from "@/server/scenarios";
import { implementationLabels, oodaLabels } from "@/domain/scenario";
export const dynamic = "force-dynamic";
export const metadata = { title: "Карточка сценария" };
const metricNames = {
  market_maturity: "Рыночная зрелость",
  organizational_readiness: "Организационная готовность",
  business_impact: "Влияние на бизнес-цели",
  application_trl: "TRL применения",
  solution_potential: "Потенциал решения",
};
export default async function ScenarioDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const item = await getScenario(id);
  if (!item) notFound();
  const related = await relatedObjects(id),
    scenario = item.scenario;
  return (
    <div className="page detail-page">
      <Link href="/scenarios" className="back-link">
        <ArrowLeft size={15} /> К каталогу сценариев
      </Link>
      <div className="detail-header">
        <div className="record-id">
          {scenario.externalId}
          <span className="tag">
            {scenario.isSynthetic
              ? "Синтетическая запись"
              : "Импортированная запись"}
          </span>
        </div>
        <h1>{scenario.name}</h1>
        <p>{scenario.description}</p>
        <span className={`status ${scenario.implementation}`}>
          <i />
          {implementationLabels[scenario.implementation]}
        </span>
      </div>
      <div className="detail-grid">
        <section className="surface detail-section">
          <h2>Описание сценария</h2>
          <dl>
            {[
              ["Функциональная группа", item.functionalGroup],
              ["Бизнес-процесс", item.business],
              ["Бизнес-вызов", scenario.businessChallenge],
              ["Обоснование", scenario.rationale],
              [
                "Цикл OODA",
                scenario.ooda
                  ? oodaLabels[scenario.ooda as keyof typeof oodaLabels]
                  : null,
              ],
              ["Технологический тренд", scenario.technologyTrend],
              ["Предложение проекта", scenario.projectProposal],
              ["Источник", item.source],
              [
                "Исходный идентификатор",
                `${scenario.originNamespace} / ${scenario.externalId}`,
              ],
              [
                "Обновлено",
                new Intl.DateTimeFormat("ru-RU", {
                  timeZone: "Europe/Moscow",
                }).format(scenario.updatedAt),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? "Не указано"}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="surface detail-section">
          <h2>Оценки и их происхождение</h2>
          <p className="muted">
            Показатели независимы. Неизвестные значения не рассчитываются.
          </p>
          {Object.entries(metricNames).map(([metric, name]) => {
            const ratings = item.assessments.filter(
              (a) => a.assessment.metric === metric,
            );
            return (
              <div className="assessment-block" key={metric}>
                <h3>{name}</h3>
                {ratings.length ? (
                  ratings.map(({ assessment: a, source }) => (
                    <div className="assessment-line" key={a.id}>
                      <strong>{a.value ?? a.qualitativeValue}</strong>
                      <div>
                        <span>
                          {a.organizationalContext} ·{" "}
                          {a.isCurrent ? "Текущая" : "Архивная"}
                        </span>
                        <small>
                          {source ?? "Источник не указан"} ·{" "}
                          {new Intl.DateTimeFormat("ru-RU", {
                            timeZone: "Europe/Moscow",
                          }).format(a.assessedAt)}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <span className="unknown-value">Неизвестно</span>
                )}
              </div>
            );
          })}
        </section>
      </div>
      <section className="surface detail-section">
        <h2>Технологическая классификация</h2>
        {related.technologies.map((t) => (
          <div className="technology-chain" key={t.id}>
            <span>{t.direction}</span>
            <span>→</span>
            <strong>{t.technology}</strong>
            <span>→</span>
            <span>{t.name}</span>
          </div>
        ))}
        {!related.technologies.length && (
          <p className="muted">Технологии пока не сопоставлены.</p>
        )}
      </section>
      <div className="related-grid">
        {[
          ["Классы задач", related.tasks],
          ["Типы бизнес-эффектов", related.effects],
          ["Кейсы бенчмаркинга", related.cases],
          ["Решения поставщиков", related.solutions],
          ["Внутренние проекты", related.projects],
        ].map(([title, objects]) => (
          <section className="surface detail-section" key={String(title)}>
            <h2>{String(title)}</h2>
            {(objects as { id: string; name: string; vendor?: string }[])
              .length ? (
              <ul>
                {(
                  objects as { id: string; name: string; vendor?: string }[]
                ).map((o) => (
                  <li key={o.id}>
                    {o.name}
                    {o.vendor && <small className="muted"> · {o.vendor}</small>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Связи не добавлены</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
