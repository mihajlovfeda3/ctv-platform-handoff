"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  editFilter,
  filterDraft,
  filterErrors,
  type FilterDraft,
} from "./filter-state";
import { scenarioQuery, type ScenarioQuery } from "@/domain/scenario";
import type { getReferences } from "@/server/scenarios";
import { workspaceHref, type ScenarioView } from "./navigation";
export function ScenarioFilters({
  query,
  references,
  view,
  invalidDraft,
}: {
  query: ScenarioQuery;
  references: Awaited<ReturnType<typeof getReferences>>;
  view: ScenarioView;
  invalidDraft?: FilterDraft;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const queryKey = JSON.stringify([query, invalidDraft]);
  const [previousKey, setPreviousKey] = useState(queryKey);
  const [draft, setDraft] = useState<FilterDraft>(
    () => invalidDraft ?? filterDraft(query),
  );
  if (previousKey !== queryKey) {
    setPreviousKey(queryKey);
    setDraft(invalidDraft ?? filterDraft(query));
  }
  const errors = filterErrors(draft);
  const options = (max: number) =>
    Array.from({ length: max }, (_, i) => ({
      id: String(i + 1),
      name: String(i + 1),
    }));
  const field = (
    key: keyof ScenarioQuery,
    label: string,
    items: { id: string; name: string }[],
    empty = "Все",
  ) => (
    <label key={key}>
      <span>{label}</span>
      <select
        name={key}
        value={draft[key] ?? ""}
        onChange={() => {}}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `error-${key}` : undefined}
      >
        <option value="">{empty}</option>
        {items.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {errors[key] && (
        <small className="filter-error" id={`error-${key}`} role="alert">
          {errors[key]}
        </small>
      )}
    </label>
  );
  function apply(target: HTMLInputElement | HTMLSelectElement) {
    const next = editFilter(draft, target.name, target.value);
    setDraft(next);
    if (Object.keys(filterErrors(next)).length) return;
    const patch: Record<string, string | undefined> = { page: undefined };
    for (const [key, value] of Object.entries(next))
      patch[key] = value || undefined;
    startTransition(() =>
      router.replace(workspaceHref(view, query, patch), { scroll: false }),
    );
  }
  return (
    <form
      className="surface shared-filters"
      onSubmit={(e) => {
        e.preventDefault();
        const result = scenarioQuery.safeParse(draft);
        if (result.success)
          startTransition(() =>
            router.replace(
              workspaceHref(view, result.data, { page: undefined }),
              { scroll: false },
            ),
          );
      }}
      onChange={(e) => apply(e.target as unknown as HTMLInputElement)}
      aria-label="Общие фильтры сценариев"
      aria-busy={pending}
    >
      <div className="shared-filter-row">
        <label className="scenario-search">
          <span>ПОИСК</span>
          <input
            name="q"
            value={draft.q ?? ""}
            onChange={() => {}}
            maxLength={200}
            placeholder="Название, описание или ID"
          />
        </label>
        {field(
          "blockId",
          "БЛОК „ГАЗПРОМ НЕФТЬ“",
          references.blocks,
          "Все блоки",
        )}
        {field(
          "businessDirectionId",
          "БИЗНЕС-НАПРАВЛЕНИЕ",
          references.businessDirections,
          "Все направления",
        )}
        {field(
          "directionId",
          "ТЕХНОЛОГИЧЕСКОЕ НАПРАВЛЕНИЕ",
          references.directions,
          "Все направления",
        )}
        {field("maturity", "РЫНОЧНАЯ ЗРЕЛОСТЬ", options(5), "Любая зрелость")}
        {field(
          "implementation",
          "РЕАЛИЗАЦИЯ",
          [
            { id: "yes", name: "Реализуется" },
            { id: "no", name: "Не реализуется" },
            { id: "unknown", name: "Неизвестно" },
          ],
          "Любой статус",
        )}
        <Link
          replace
          scroll={false}
          className="button"
          href={workspaceHref(view, {
            context: query.context,
            mode: query.mode,
          })}
        >
          Сбросить
        </Link>
      </div>
      <details
        className="advanced-filters"
        open={Object.keys(errors).length > 0 ? true : undefined}
      >
        <summary>
          Дополнительные параметры{" "}
          <span>
            {pending ? "Обновляем выборку…" : "Диапазоны · оценки · контекст"}
          </span>
        </summary>
        <div className="advanced-grid">
          {field(
            "businessNodeId",
            "Бизнес-процесс / этап",
            references.business.map((n) => ({
              ...n,
              name: `${n.kind === "direction" ? "Направление" : n.kind === "process" ? "Процесс" : "Этап"} · ${n.name}`,
            })),
            "Все процессы",
          )}

          {field(
            "functionalGroupId",
            "Функциональная группа",
            references.groups,
          )}
          {field("readiness", "ОГ: точное значение", options(7))}
          {field("impact", "Влияние: точное значение", options(3))}
          {(["maturity", "readiness", "impact"] as const).flatMap((prefix, i) =>
            (["Min", "Max"] as const).map((bound) =>
              field(
                `${prefix}${bound}`,
                `${["РЗ", "ОГ", "Влияние"][i]} ${bound === "Min" ? "от" : "до"}`,
                options([5, 7, 3][i]),
                "Не ограничено",
              ),
            ),
          )}
          <label>
            <span>Организационный контекст</span>
            <input
              name="context"
              value={draft.context ?? ""}
              onChange={() => {}}
              required
              maxLength={160}
            />
          </label>
        </div>
      </details>
    </form>
  );
}
