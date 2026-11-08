"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { getScenario } from "@/server/scenarios";
import type { AnalyticRow } from "@/domain/analytics";
import { implementationLabel } from "@/domain/scenario";
import { workspaceQuery } from "@/features/scenarios/filter-state";
import { cardHref } from "@/features/scenarios/navigation";
import styles from "./cube-prototype.module.css";

export function CubeInspector({
  row,
  onClose,
  coincident,
  onSelect,
}: {
  row: AnalyticRow;
  onClose: () => void;
  coincident: AnalyticRow[];
  onSelect: (id: string) => void;
}) {
  const [item, setItem] =
    useState<Awaited<ReturnType<typeof getScenario>>>(null);
  const [error, setError] = useState(false);
  const params = useSearchParams();
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/scenarios/${row.id}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setItem)
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, [row.id]);
  const query = workspaceQuery(Object.fromEntries(params))?.query ?? {};
  return (
    <aside
      className={styles.inspector}
      aria-label="Быстрый просмотр сценария"
      aria-live="polite"
    >
      <header>
        <span>{row.externalId}</span>
        <button aria-label="Закрыть инспектор" onClick={onClose}>
          ×
        </button>
      </header>
      <details open className={styles.inspectorContent}>
        <summary>Выбранный сценарий</summary>
        <div className={styles.inspectorBody}>
          <h2>
            <strong>{row.name}</strong>
          </h2>
          <span className={styles.statusBadge} data-status={row.implementation}>
            {implementationLabel(row.implementation)}
          </span>
          <p>
            {item
              ? item.scenario.description.trim() || "Описание не указано"
              : error
                ? "Не удалось загрузить описание"
                : "Загрузка описания…"}
          </p>
          <div className={styles.metrics}>
            {[
              ["Рыночная зрелость", row.maturity, 5],
              ["Орг. готовность", row.readiness, 7],
              ["Влияние", row.impact, 3],
            ].map(([label, value, max]) => (
              <div key={label}>
                <b>
                  {value ?? "—"}
                  <small> / {max}</small>
                </b>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <h3>Технологическое направление</h3>
          <p>{row.directions.map((d) => d.name).join(", ") || "Не указано"}</p>
          {item && (
            <dl>
              <dt>Блок «Газпром нефти»</dt>
              <dd>{item.classification?.block || "Не указан"}</dd>
              <dt>Функциональная группа</dt>
              <dd>{item.functionalGroup || "Не указана"}</dd>
              <dt>Бизнес-процесс</dt>
              <dd>{item.business || "Не указан"}</dd>
              <dt>Бизнес-эффект</dt>
              <dd>{item.scenario.businessEffect || "Не указан"}</dd>
              <dt>Источник</dt>
              <dd>{item.source || "Не указан"}</dd>
            </dl>
          )}
          {coincident.length > 1 && (
            <details>
              <summary>В этой позиции: {coincident.length}</summary>
              {coincident.map((r) => (
                <button key={r.id} onClick={() => onSelect(r.id)}>
                  {r.externalId} · {r.name}
                </button>
              ))}
            </details>
          )}
        </div>
      </details>
      <footer>
        <Link href={cardHref(row.id, "cube", query)}>
          Открыть полную карточку →
        </Link>
      </footer>
    </aside>
  );
}
