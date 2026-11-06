import type { ScenarioQuery } from "@/domain/scenario";
export const views = {
  catalog: "Каталог",
  radar: "Технологический радар",
  maturity: "Матрица зрелости",
  cube: "3D-куб",
} as const;
export type ScenarioView = keyof typeof views;
export function workspaceHref(
  view: ScenarioView,
  query: Partial<ScenarioQuery>,
  patch: Record<string, string | number | undefined> = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...patch }))
    if (key !== "from" && value !== undefined && value !== "")
      params.set(key, String(value));
  return `/scenarios/${view}${params.size ? `?${params}` : ""}`;
}
export function cardHref(
  id: string,
  view: ScenarioView,
  query: Partial<ScenarioQuery>,
) {
  const href = workspaceHref(view, query, { selected: id });
  return (
    href.replace(`/scenarios/${view}`, `/scenarios/${id}`) + `&from=${view}`
  );
}
