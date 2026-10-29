"use client";
import { useEffect, useRef } from "react";
import { ContextLink as Link } from "./camera-context";
import { CardLink } from "./scroll-context";
import type { getScenario, relatedObjects } from "@/server/scenarios";
import { Metrics } from "./metrics";
import { implementationLabels } from "@/domain/scenario";
export function Inspector({
  item,
  related,
  closeHref,
  fullHref,
  context,
  variant,
}: {
  item: NonNullable<Awaited<ReturnType<typeof getScenario>>>;
  related: Awaited<ReturnType<typeof relatedObjects>>;
  closeHref: string;
  fullHref: string;
  context: string;
  variant?: "catalog";
}) {
  const close = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (variant !== "catalog") close.current?.focus({ preventScroll: true });
    return () => {
      if (
        variant !== "catalog" ||
        document.activeElement?.closest(".catalog-inspector")
      )
        previous?.focus({ preventScroll: true });
    };
  }, [closeHref, variant]);
  if (variant === "catalog") {
    const values = item.assessments
      .map((a) => a.assessment)
      .filter((a) => a.isCurrent && a.organizationalContext === context);
    return (
      <aside
        className="scenario-inspector catalog-inspector"
        role="region"
        aria-label="Быстрый просмотр сценария"
      >
        <div className="inspector-top">
          <span>{item.scenario.externalId}</span>
          <Link
            replace
            ref={close}
            href={closeHref}
            scroll={false}
            aria-label="Закрыть инспектор"
          >
            ×
          </Link>
        </div>
        <div className="inspector-body">
          <h2>{item.scenario.name}</h2>
          <span className={`status ${item.scenario.implementation}`}>
            <i />
            {implementationLabels[item.scenario.implementation]}
          </span>
          <p className="inspector-description">{item.scenario.description}</p>
          <div className="catalog-metrics">
            {[
              ["market_maturity", "РЗ", 5],
              ["organizational_readiness", "ОГ", 7],
              ["business_impact", "Влияние", 3],
            ].map(([key, label, max]) => {
              const v = values.find((a) => a.metric === key)?.value;
              return (
                <div key={key}>
                  <span>{label}</span>
                  <strong>{v == null ? "—" : `${v}/${max}`}</strong>
                </div>
              );
            })}
          </div>
          <section>
            <h3>Бизнес-контекст</h3>
            <dl>
              <dt>Блок «Газпром нефти»</dt>
              <dd>{item.classification?.block ?? "Не указан"}</dd>
              <dt>Бизнес-направление</dt>
              <dd>{item.classification?.businessDirection ?? "Не указано"}</dd>
              <dt>Процесс</dt>
              <dd>{item.business ?? "Не указан"}</dd>
              {item.functionalGroup && (
                <>
                  <dt>Функциональная группа</dt>
                  <dd>{item.functionalGroup}</dd>
                </>
              )}
            </dl>
          </section>
          <section>
            <h3>Технологическая классификация</h3>
            {related.technologies.length ? (
              related.technologies.map((t) => (
                <div className="technology-path" key={t.id}>
                  <strong>{t.direction}</strong>
                  <span>{t.technology}</span>
                  <span>{t.name}</span>
                </div>
              ))
            ) : (
              <p>Связанные технологии не указаны</p>
            )}
          </section>
          <section>
            <h3>Связанные объекты</h3>
            <p className="related-summary">
              {related.tasks.length} задач · {related.effects.length} эффектов ·{" "}
              {related.cases.length} кейсов · {related.solutions.length} решений
              · {related.projects.length} проектов
            </p>
          </section>
        </div>
        <div className="inspector-footer">
          <CardLink
            className="button primary"
            href={fullHref}
            returnHref={closeHref + `&selected=${item.scenario.id}`}
          >
            Открыть полную карточку →
          </CardLink>
        </div>
      </aside>
    );
  }
  return (
    <aside
      className="scenario-inspector"
      role="region"
      aria-label="Быстрый просмотр сценария"
    >
      <div className="inspector-top">
        <span>БЫСТРЫЙ ПРОСМОТР</span>
        <Link
          replace
          ref={close}
          href={closeHref}
          scroll={false}
          aria-label="Закрыть инспектор"
        >
          ×
        </Link>
      </div>
      <span className="record-id">{item.scenario.externalId}</span>
      <h2>{item.scenario.name}</h2>
      <span className={`status ${item.scenario.implementation}`}>
        <i />
        {implementationLabels[item.scenario.implementation]}
      </span>
      <p>{item.scenario.description}</p>
      <Metrics
        assessments={item.assessments
          .map((a) => a.assessment)
          .filter((a) => a.isCurrent && a.organizationalContext === context)}
      />
      <h3>Блок «Газпром нефти»</h3>
      <p>{item.classification?.block ?? "Не указан"}</p>
      <h3>Бизнес-направление</h3>
      <p>{item.classification?.businessDirection ?? "Не указано"}</p>
      {item.classification?.isSynthetic && (
        <p>Связи классификации синтетические</p>
      )}
      <h3>Бизнес-процесс</h3>
      <p>{item.business ?? "Не указан"}</p>
      <h3>Технологическая классификация</h3>
      {related.technologies.map((t) => (
        <p key={t.id}>
          {t.direction} → {t.technology} → {t.name}
        </p>
      ))}
      <h3>Связанные объекты</h3>
      <p>
        {related.tasks.length} задач · {related.effects.length} эффектов ·{" "}
        {related.cases.length} кейсов · {related.solutions.length} решений ·{" "}
        {related.projects.length} проектов
      </p>
      <CardLink
        className="button primary"
        href={fullHref}
        returnHref={closeHref + `&selected=${item.scenario.id}`}
      >
        Открыть полную карточку →
      </CardLink>
    </aside>
  );
}
