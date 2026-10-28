"use client";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ScenarioQuery } from "@/domain/scenario";
import type { getReferences } from "@/server/scenarios";
import { workspaceHref, type ScenarioView } from "./navigation";
export function ScenarioFilters({
  query,
  references,
  view,
}: {
  query: ScenarioQuery;
  references: Awaited<ReturnType<typeof getReferences>>;
  view: ScenarioView;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useOptimistic(query.q);
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
      <select name={key} value={String(query[key] ?? "")} onChange={() => {}}>
        <option value="">{empty}</option>
        {items.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
  function apply(form: HTMLFormElement, target?: HTMLInputElement) {
    const patch: Record<string, string | undefined> = { page: undefined };
    for (const [key, value] of new FormData(form))
      patch[key] = String(value) || undefined;
    if (target?.name.endsWith("Min") || target?.name.endsWith("Max"))
      patch[target.name.replace(/Min|Max/, "")] = undefined;
    if (target?.name === "maturity") {
      patch.maturityMin = undefined;
      patch.maturityMax = undefined;
    }
    startTransition(() => {
      if (target?.name === "q") setSearch(target.value);
      router.replace(workspaceHref(view, query, patch), { scroll: false });
    });
  }
  return (
    <form
      className="surface shared-filters"
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
      onChange={(e) =>
        apply(e.currentTarget, e.target as unknown as HTMLInputElement)
      }
      aria-label="Общие фильтры сценариев"
      aria-busy={pending}
    >
      <div className="shared-filter-row">
        <label className="scenario-search">
          <span>ПОИСК</span>
          <input
            name="q"
            value={search}
            onChange={() => {}}
            maxLength={200}
            placeholder="Название, описание или ID"
          />
        </label>
        {field(
          "directionId",
          "ТЕХНОЛОГИЯ",
          references.directions,
          "Все направления",
        )}
        {field("businessNodeId", "БИЗНЕС", references.business, "Все процессы")}
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
          className="button"
          href={workspaceHref(view, {
            context: query.context,
            mode: query.mode,
          })}
        >
          Сбросить
        </Link>
      </div>
      <details className="advanced-filters">
        <summary>
          Дополнительные параметры{" "}
          <span>
            {pending ? "Обновляем выборку…" : "Диапазоны · оценки · контекст"}
          </span>
        </summary>
        <div className="advanced-grid">
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
              defaultValue={query.context}
              required
              maxLength={160}
            />
          </label>
        </div>
      </details>
    </form>
  );
}
