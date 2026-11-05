"use client";
import { ImplementationStatus } from "@/features/scenarios/implementation-status";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minimize2 } from "lucide-react";
import { ContextLink as Link } from "./camera-context";
import { CardLink } from "./scroll-context";
import type { getScenario, relatedObjects } from "@/server/scenarios";
import { Metrics } from "./metrics";
import { FloatingInspector } from "./floating-inspector";
import floatingStyles from "./floating-inspector.module.css";
export function Inspector({
  item,
  related,
  closeHref,
  fullHref,
  context,
  variant,
}: {
  item: Awaited<ReturnType<typeof getScenario>>;
  related: Awaited<ReturnType<typeof relatedObjects>> | null;
  closeHref: string;
  fullHref: string;
  context: string;
  variant?: "catalog" | "radar" | "matrix";
}) {
  const close = useRef<HTMLAnchorElement>(null);
  const expandedPanel = useRef<HTMLElement>(null);
  const collapseButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [floatingPosition, setFloatingPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  // Camera/filter/mode changes for the same selection should not steal focus
  // from the control the user just operated. Keep other views intact.
  const focusKey =
    variant === "radar" || variant === "matrix" ? item?.scenario.id : closeHref;
  useEffect(() => {
    if (!focusKey) return;
    const previous = document.activeElement as HTMLElement | null;
    if (variant !== "catalog") close.current?.focus({ preventScroll: true });
    return () => {
      if (
        variant !== "catalog" ||
        document.activeElement?.closest(".catalog-inspector")
      )
        previous?.focus({ preventScroll: true });
    };
  }, [focusKey, variant]);
  useEffect(() => {
    if (!floatingPosition && restoreFocus.current) {
      collapseButton.current?.focus({ preventScroll: true });
      restoreFocus.current = false;
    }
  }, [floatingPosition]);
  useLayoutEffect(() => {
    const panel = expandedPanel.current;
    if (!panel) return;
    let frame = 0;
    const measure = () => {
      const top = Math.max(8, panel.getBoundingClientRect().top);
      const available = document.documentElement.clientHeight - top - 8;
      panel.style.setProperty(
        "--inspector-available-height",
        `${Math.max(120, available)}px`,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    const page = panel.closest(".scenarios-page");
    if (page) observer.observe(page);
    const filters = page?.querySelector(".shared-filters");
    if (filters) observer.observe(filters);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
    };
  }, [focusKey, floatingPosition]);
  if (!item || !related) return null;
  const group =
    item.functionalGroup ??
    (item.functionalGroupConflict || item.functionalGroupUnmapped
      ? "Требует сопоставления"
      : "Не указана");
  const description = item.scenario.description.trim() || "Не указано";
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
          <ImplementationStatus value={item.scenario.implementation} />
          <p className="inspector-description">{description}</p>
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
              <dt>Функциональная группа</dt>
              <dd>{group}</dd>
              <dt>Бизнес-процесс</dt>
              <dd>{item.business ?? "Не указан"}</dd>
              <dt>Бизнес-эффект</dt>
              <dd>{item.scenario.businessEffect?.trim() || "Не указано"}</dd>
              {related.effects.length > 0 && (
                <>
                  <dt>Типы эффектов</dt>
                  <dd>
                    {related.effects.map((effect) => effect.name).join(", ")}
                  </dd>
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
              {related.tasks.length} задач · {related.cases.length} кейсов ·{" "}
              {related.solutions.length} решений · {related.projects.length}{" "}
              проектов
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
  if (floatingPosition) {
    return (
      <FloatingInspector
        position={floatingPosition}
        setPosition={setFloatingPosition}
        title={item.scenario.name}
        closeHref={closeHref}
        fullHref={fullHref}
        returnHref={closeHref + `&selected=${item.scenario.id}`}
        closeRef={close}
        onExpand={() => {
          restoreFocus.current = true;
          setFloatingPosition(null);
        }}
      />
    );
  }
  return (
    <aside
      ref={expandedPanel}
      className={`scenario-inspector ${floatingStyles.expanded}`}
      role="region"
      aria-label="Быстрый просмотр сценария"
    >
      <header className={floatingStyles.header}>
        <span className="record-id">{item.scenario.externalId}</span>
        <div className={floatingStyles.actions}>
          <button
            type="button"
            ref={collapseButton}
            className={floatingStyles.iconButton}
            aria-label="Свернуть инспектор"
            title="Свернуть инспектор"
            onClick={() => {
              const rect = expandedPanel.current?.getBoundingClientRect();
              if (rect) setFloatingPosition({ x: rect.left, y: rect.top });
            }}
          >
            <Minimize2 size={14} aria-hidden="true" />
          </button>
          <Link
            className={floatingStyles.close}
            replace
            ref={close}
            href={closeHref}
            scroll={false}
            aria-label="Закрыть инспектор"
            title="Закрыть инспектор"
          >
            ×
          </Link>
        </div>
      </header>
      <div className={floatingStyles.body} data-inspector-scroll>
        <h2>{item.scenario.name}</h2>
        <ImplementationStatus value={item.scenario.implementation} />
        <p>{description}</p>
        <Metrics
          assessments={item.assessments
            .map((a) => a.assessment)
            .filter((a) => a.isCurrent && a.organizationalContext === context)}
        />
        <h3>Блок «Газпром нефти»</h3>
        <p>{item.classification?.block ?? "Не указан"}</p>
        <h3>Функциональная группа</h3>
        <p>{group}</p>
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
        <h3>Бизнес-эффект</h3>
        <p>{item.scenario.businessEffect?.trim() || "Не указано"}</p>
        {related.effects.length > 0 && (
          <p>
            Типы эффектов:{" "}
            {related.effects.map((effect) => effect.name).join(", ")}
          </p>
        )}
        <h3>Связанные объекты</h3>
        <p>
          {related.tasks.length} задач · {related.cases.length} кейсов ·{" "}
          {related.solutions.length} решений · {related.projects.length}{" "}
          проектов
        </p>
      </div>
      <footer className={floatingStyles.footer}>
        <CardLink
          className="button primary"
          href={fullHref}
          returnHref={closeHref + `&selected=${item.scenario.id}`}
        >
          Открыть полную карточку →
        </CardLink>
      </footer>
    </aside>
  );
}
