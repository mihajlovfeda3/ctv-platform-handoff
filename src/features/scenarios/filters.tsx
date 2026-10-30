"use client";
import { RangeFilter } from "./range-filter";
import { Select } from "@/components/select";
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
  const compact = view === "catalog" || view === "radar";
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
  ) =>
    compact ? (
      <div className="filter-field" key={key}>
        <span>{label}</span>
        <Select
          label={label}
          value={draft[key] ?? ""}
          items={[{ id: "", name: empty }, ...items]}
          disabled={!ready}
          invalid={!!errors[key]}
          describedBy={errors[key] ? `error-${key}` : undefined}
          onValueChange={(value) => applyValue(key, value)}
        />
        {errors[key] && (
          <small className="filter-error" id={`error-${key}`} role="alert">
            {errors[key]}
          </small>
        )}
      </div>
    ) : (
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
    applyValue(target.name, target.value);
  }
  function applyValue(name: string, value: string) {
    const next = editFilter(draft, name, value);
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
    prefix: "maturity" | "readiness" | "impact",
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
  const chips: { label: string; keys: string[] }[] = [];
  if (query.q) chips.push({ label: `Поиск: ${query.q}`, keys: ["q"] });
  for (const [key, label, items] of [
    ["blockId", "Блок", references.blocks],
    ["businessDirectionId", "Бизнес", references.businessDirections],
    ["directionId", "Технология", references.directions],
    ["functionalGroupId", "Группа", references.groups],
    ["businessNodeId", "Процесс", references.business],
  ] as const)
    if (query[key])
      chips.push({
        label: `${label}: ${items.find((i) => i.id === query[key])?.name ?? query[key]}`,
        keys: [key],
      });
  if (query.implementation)
    chips.push({
      label:
        query.implementation === "yes"
          ? "Реализуется"
          : query.implementation === "no"
            ? "Не реализуется"
            : "Статус неизвестен",
      keys: ["implementation"],
    });
  for (const [key, label, max] of [
    ["maturity", "РЗ", 5],
    ["readiness", "ОГ", 7],
    ["impact", "Влияние", 3],
  ] as const) {
    if (
      query[key] !== undefined ||
      query[`${key}Min`] !== undefined ||
      query[`${key}Max`] !== undefined
    )
      chips.push({
        label: `${label}: ${query[key] ?? query[`${key}Min`] ?? 1}–${query[key] ?? query[`${key}Max`] ?? max}`,
        keys: [key, `${key}Min`, `${key}Max`],
      });
  }
  if (!compact && query.context !== "synthetic-lab")
    chips.push({ label: `Контекст: ${query.context}`, keys: ["context"] });
  return (
    <form
      className={`surface shared-filters ${compact ? "catalog-filters" : ""} ${view === "radar" ? "radar-filters" : ""}`}
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
      {compact ? (
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
            "directionId",
            "ТЕХНОЛОГИЧЕСКОЕ НАПРАВЛЕНИЕ",
            references.directions,
            "Все направления",
          )}
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
              ...(compact
                ? {
                    selected: query.selected,
                    sort: query.sort,
                    order: query.order,
                    pageSize: query.pageSize,
                  }
                : {}),
            })}
          >
            Сбросить
          </CameraLink>
        </div>
      ) : (
        <>
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
        </>
      )}
      {Object.entries(errors)
        .filter(([key]) =>
          ["maturity", "readiness", "impact"].some((prefix) =>
            key.startsWith(prefix),
          ),
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
      {compact && chips.length > 0 && (
        <div className="filter-chips" aria-label="Активные ограничения">
          {chips.map((chip) => (
            <CameraLink
              key={chip.keys[0]}
              replace
              scroll={false}
              title={chip.label}
              aria-label={`Снять фильтр: ${chip.label}`}
              href={workspaceHref(view, query, {
                ...Object.fromEntries(chip.keys.map((key) => [key, undefined])),
                page: 1,
                ...(chip.keys[0] === "context"
                  ? { context: "synthetic-lab" }
                  : {}),
              })}
            >
              <span>{chip.label}</span>
              <span aria-hidden="true">×</span>
            </CameraLink>
          ))}
        </div>
      )}
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
          {compact && (
            <>
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
              {range("maturity", "Рыночная зрелость (РЗ)", 5)}
              {range("readiness", "Организационная готовность (ОГ)", 7)}
            </>
          )}

          {!compact && (
            <label>
              <span>Бизнес-процесс / этап</span>
              <select disabled aria-label="Бизнес-процесс / этап">
                <option>Справочник не согласован</option>
              </select>
            </label>
          )}
          {field(
            "functionalGroupId",
            "Функциональная группа",
            references.groups,
          )}
          {!compact && field("impact", "Влияние: точное значение", options(3))}
          {range("impact", "Влияние на бизнес-цели", 3)}
          {view !== "catalog" && (
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
          )}
        </div>
      </details>
    </form>
  );
}
