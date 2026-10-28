import { scenarioQuery, type ScenarioQuery } from "@/domain/scenario";
export const scoreFields = ["maturity", "readiness", "impact"] as const;
export type FilterDraft = Record<string, string>;
export function filterDraft(query: Partial<ScenarioQuery>): FilterDraft {
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, String(value ?? "")]),
  );
}
export function editFilter(
  draft: FilterDraft,
  name: string,
  value: string,
): FilterDraft {
  const next = { ...draft, [name]: value };
  for (const prefix of scoreFields) {
    if (name === prefix) {
      next[`${prefix}Min`] = "";
      next[`${prefix}Max`] = "";
    }
    if (name === `${prefix}Min` || name === `${prefix}Max`) next[prefix] = "";
  }
  return next;
}
export function filterErrors(draft: FilterDraft) {
  const result = scenarioQuery.safeParse(draft),
    errors: Record<string, string> = {};
  if (!result.success)
    for (const issue of result.error.issues) {
      const field = String(issue.path[0]);
      errors[field] = issue.message;
      if (
        scoreFields.some((p) => field === `${p}Max`) &&
        issue.code === "custom"
      )
        errors[field.replace(/Max$/, "Min")] = issue.message;
    }
  return errors;
}
/** Only contradictory bounds are recoverable in the workspace. HTTP API stays strict. */
export function workspaceQuery(raw: Record<string, unknown>) {
  const strict = scenarioQuery.safeParse(raw);
  if (strict.success) return { query: strict.data, invalidDraft: undefined };
  if (
    !strict.error.issues.every(
      (i) =>
        i.code === "custom" && scoreFields.some((p) => i.path[0] === `${p}Max`),
    )
  )
    return null;
  const safe = { ...raw };
  for (const prefix of scoreFields)
    if (Number(raw[`${prefix}Min`]) > Number(raw[`${prefix}Max`])) {
      delete safe[`${prefix}Min`];
      delete safe[`${prefix}Max`];
    }
  const parsed = scenarioQuery.safeParse(safe);
  if (!parsed.success) return null;
  return {
    query: parsed.data,
    invalidDraft: {
      ...filterDraft(parsed.data),
      ...Object.fromEntries(
        Object.entries(raw).filter(([, v]) => typeof v === "string"),
      ),
    } as FilterDraft,
  };
}
