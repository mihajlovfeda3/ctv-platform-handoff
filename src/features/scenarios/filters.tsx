"use client";
import { RangeFilter } from "./range-filter";
import { useState, useTransition, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { ContextLink as CameraLink } from "./camera-context";
import { useRouter } from "next/navigation";
import {
  editFilter,
  filterDraft,
  filterErrors,
  type FilterDraft,
} from "./filter-state";
import { scenarioQuery, type ScenarioQuery } from "@/domain/scenario";
import type { getReferences } from "@/server/scenarios";
import { workspaceHref, type ScenarioView } from "./navigation";
const subscribeHydration = () => () => {};
export function ScenarioFilters({
  query: serverQuery,
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
  const liveParams = useSearchParams();
  const query = {
    ...serverQuery,
    zoom: Number(liveParams.get("zoom") ?? serverQuery.zoom),
    panX: Number(liveParams.get("panX") ?? serverQuery.panX),
    panY: Number(liveParams.get("panY") ?? serverQuery.panY),
  };
  const ready = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
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
        disabled={!ready}
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
  function commitRange() {
    if (Object.keys(filterErrors(draft)).length) return;
    const patch: Record<string, string | undefined> = { page: undefined };
    for (const [key, value] of Object.entries(draft))
      patch[key] = value || undefined;
    startTransition(() =>
      router.replace(workspaceHref(view, query, patch), { scroll: false }),
    );
  }
  const range = (
    prefix: "maturity" | "readiness",
    label: string,
    max: number,
  ) => {
    const low = Number(draft[prefix + "Min"] || draft[prefix] || 1),
      high = Number(draft[prefix + "Max"] || draft[prefix] || max);
    return (
      <RangeFilter
        disabled={!ready}
        label={label}
        prefix={prefix}
        max={max}
        low={low}
        high={high}
        onCommit={commitRange}
        onChange={(lo, hi) =>
          setDraft((prev) => ({
            ...prev,
            [prefix]: "",
            [prefix + "Min"]: lo === 1 && hi === max ? "" : String(lo),
            [prefix + "Max"]: lo === 1 && hi === max ? "" : String(hi),
          }))
        }
      />
    );
  };
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
      aria-busy={pending || !ready}
    >
      <div className="shared-filter-row">
        <label className="scenario-search">
          <span>ПОИСК</span>
          <input
            disabled={!ready}
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
        {range("maturity", "Рыночная зрелость (РЗ)", 5)}
        {range("readiness", "Организационная готовность (ОГ)", 7)}
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
        <CameraLink
          replace
          scroll={false}
          className="button"
          href={workspaceHref(view, {
            context: query.context,
            mode: query.mode,
          })}
        >
          Сбросить
        </CameraLink>
      </div>
      {Object.entries(errors)
        .filter(
          ([key]) => key.startsWith("maturity") || key.startsWith("readiness"),
        )
        .map(([key, message]) => (
          <small
            className="filter-error"
            key={key}
            id={`error-${key}`}
            role="alert"
          >
            {message}
          </small>
        ))}
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
          <label>
            <span>Бизнес-процесс / этап</span>
            <select disabled aria-label="Бизнес-процесс / этап">
              <option>Справочник не согласован</option>
            </select>
          </label>
          {field(
            "functionalGroupId",
            "Функциональная группа",
            references.groups,
          )}
          {field("impact", "Влияние: точное значение", options(3))}
          {(["impact"] as const).flatMap((prefix, i) =>
            (["Min", "Max"] as const).map((bound) =>
              field(
                `${prefix}${bound}`,
                `${["Влияние"][i]} ${bound === "Min" ? "от" : "до"}`,
                options([3][i]),
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
