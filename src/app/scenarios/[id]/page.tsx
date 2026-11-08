import { ImplementationStatus } from "@/features/scenarios/implementation-status";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getScenario, relatedObjects } from "@/server/scenarios";
import { oodaLabels, scenarioQuery } from "@/domain/scenario";
import { workspaceHref } from "@/features/scenarios/navigation";
import { Metrics } from "@/features/scenarios/metrics";
import styles from "@/features/scenarios/scenario-cards.module.css";
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
  const rawQuery = await searchParams;
  const queryResult = scenarioQuery.safeParse(rawQuery);
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
    <div className={`page detail-page revised-card ${styles.full}`}>
      <Link
        scroll={false}
        className="back-link"
        href={workspaceHref(
          query.from,
          query,
          query.from === "maturity" &&
            (rawQuery.matrixMode === "cells" ||
              rawQuery.matrixMode === "points")
            ? { matrixMode: rawQuery.matrixMode }
            : {},
        )}
      >
        ← Вернуться к выборке
      </Link>
      <header className="detail-header">
        <h1>{s.name}</h1>
        <p>{s.description.trim() || "Не указано"}</p>
        <ImplementationStatus value={s.implementation} />
        <Metrics assessments={current} />
      </header>
      <section className="surface detail-section">
        <h2>Технологическая классификация</h2>
        {related.technologies.map((t) => (
          <ol className={styles.technology} key={t.id}>
            {[
              ["Технологическое направление", t.direction],
              ["Ключевая технология", t.technology],
              ["Метод использования", t.name],
            ].map(([label, value]) => (
              <li key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </li>
            ))}
          </ol>
        ))}
        {!related.technologies.length && <p>Не сопоставлена</p>}
      </section>
      <section className="surface detail-section">
        <h2>Бизнес-контекст</h2>
        <dl className={styles.businessDetails}>
          <div>
            <dt>Бизнес-процесс</dt>
            <dd>{item.business || "Не указано"}</dd>
          </div>
          <div>
            <dt>Функциональная группа</dt>
            <dd>
              {item.functionalGroup ??
                (item.functionalGroupConflict || item.functionalGroupUnmapped
                  ? "Требует сопоставления"
                  : "Не указано")}
            </dd>
          </div>
          <div className={styles.wide}>
            <dt>Бизнес-вызов</dt>
            <dd>{s.businessChallenge || "Не указано"}</dd>
            {s.businessChallengeDescription?.trim() && (
              <>
                <dt className={styles.challengeLabel}>
                  Описание бизнес-вызова
                </dt>
                <dd>{s.businessChallengeDescription}</dd>
              </>
            )}
          </div>
          <div className={styles.wide}>
            <dt>Бизнес-эффект</dt>
            <dd>{s.businessEffect?.trim() || "Не указано"}</dd>
          </div>
        </dl>
      </section>
      <section className="surface detail-section linked-objects">
        <h2>Задачи, эффекты и связанные объекты</h2>
        {[
          ["Классы задач", related.tasks],
          ["Типы эффектов", related.effects],
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
        <summary>
          Техническая информация и дополнительные характеристики
        </summary>
        <dl>
          {[
            ["ID сценария", s.externalId],
            [
              "Тип записи",
              s.isSynthetic ? "Синтетическая запись" : "Импортированная запись",
            ],
            ["Блок «Газпром нефти»", item.classification?.block],
            [
              "Происхождение связей классификации",
              item.classification?.isSynthetic
                ? "Синтетические назначения"
                : "Не указано",
            ],
            ["Обоснование", s.rationale],
            ["Предложение проекта", s.projectProposal],
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
