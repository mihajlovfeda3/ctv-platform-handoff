"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { getScenario, relatedObjects } from "@/server/scenarios";
import { Metrics } from "./metrics";
import { implementationLabels } from "@/domain/scenario";
export function Inspector({
  item,
  related,
  closeHref,
  fullHref,
  context,
}: {
  item: NonNullable<Awaited<ReturnType<typeof getScenario>>>;
  related: Awaited<ReturnType<typeof relatedObjects>>;
  closeHref: string;
  fullHref: string;
  context: string;
}) {
  const router = useRouter(),
    close = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push(closeHref, { scroll: false });
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, [router, closeHref]);
  return (
    <aside
      className="scenario-inspector"
      role="region"
      aria-label="Быстрый просмотр сценария"
    >
      <div className="inspector-top">
        <span>БЫСТРЫЙ ПРОСМОТР</span>
        <Link
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
      <Link className="button primary" href={fullHref}>
        Открыть полную карточку →
      </Link>
    </aside>
  );
}
