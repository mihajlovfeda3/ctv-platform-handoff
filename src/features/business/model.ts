import { z } from "zod";
export const businessQuery = z.object({
  process: z.uuid().optional(),
  direction: z.uuid().optional(),
  q: z.string().trim().max(200).default(""),
  implementation: z.enum(["all", "yes", "no"]).default("all"),
  sort: z.enum(["name", "scenarios", "implemented"]).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
  context: z.string().trim().min(1).max(160).default("synthetic-lab"),
  cell: z.uuid().optional(),
  cellDirection: z.uuid().optional(),
  from: z.enum(["landscape", "tasks", "coverage"]).default("tasks"),
});
export type BusinessQuery = z.infer<typeof businessQuery>;
export const businessViews = {
  landscape: "Бизнес-ландшафт",
  tasks: "Классы задач",
  coverage: "Матрица покрытия ЦТ",
} as const;
export type BusinessView = keyof typeof businessViews;
export function businessHref(
  view: BusinessView,
  query: Partial<BusinessQuery>,
  patch: Partial<Record<keyof BusinessQuery, string | undefined>> = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...patch }))
    if (
      value &&
      !["from", "cell", "cellDirection"].includes(key) &&
      !(key === "implementation" && value === "all")
    )
      params.set(key, value);
  for (const key of ["cell", "cellDirection"] as const)
    if (view === "coverage" && patch[key]) params.set(key, patch[key]!);
  return `/business/${view}${params.size ? `?${params}` : ""}`;
}
export function taskHref(
  id: string,
  view: BusinessView,
  query: Partial<BusinessQuery>,
) {
  const href = businessHref(view, query);
  const params = new URLSearchParams(href.split("?")[1]);
  params.set("from", view);
  if (query.cell) params.set("cell", query.cell);
  if (query.cellDirection) params.set("cellDirection", query.cellDirection);
  return `/business/tasks/${id}?${params}`;
}
export type Named = { id: string; name: string };
export type Process = Named & {
  parentId: string | null;
  description: string | null;
  kind: string;
  isSynthetic: boolean;
};
export type Task = Named & {
  businessNodeId: string | null;
  description: string | null;
  isSynthetic: boolean;
  sourceId: string | null;
};
export type BusinessScenario = Named & {
  description: string;
  businessNodeId: string | null;
  implementation: string;
  isSynthetic: boolean;
};
export type Relation = { scenarioId: string; id: string };
export type BusinessFacts = {
  processes: Process[];
  tasks: Task[];
  scenarios: BusinessScenario[];
  directions: Named[];
  taskLinks: Relation[];
  directionLinks: Relation[];
  effects: (Relation & { name: string })[];
  cases: (Relation & {
    name: string;
    description: string | null;
    implementationYear: number | null;
    isSynthetic: boolean;
  })[];
  scores: { scenarioId: string; metric: string; value: number | null }[];
  sources: Named[];
};
export function createBusinessIndex(facts: BusinessFacts) {
  const scenarioById = new Map(facts.scenarios.map((s) => [s.id, s]));
  const taskScenarios = new Map<string, Set<string>>();
  const scenarioDirections = new Map<string, Set<string>>();
  for (const link of facts.taskLinks) {
    if (!taskScenarios.has(link.id)) taskScenarios.set(link.id, new Set());
    if (scenarioById.has(link.scenarioId))
      taskScenarios.get(link.id)!.add(link.scenarioId);
  }
  for (const link of facts.directionLinks) {
    if (!scenarioDirections.has(link.scenarioId))
      scenarioDirections.set(link.scenarioId, new Set());
    scenarioDirections.get(link.scenarioId)!.add(link.id);
  }
  const descendants = (id: string): Set<string> => {
    const result = new Set<string>();
    const queue = [id];
    while (queue.length) {
      const next = queue.pop()!;
      if (result.has(next)) continue;
      result.add(next);
      for (const p of facts.processes)
        if (p.parentId === next) queue.push(p.id);
    }
    return result;
  };
  const ancestors = (id: string): Process[] => {
    const result: Process[] = [];
    const visited = new Set<string>();
    let current = facts.processes.find((p) => p.id === id);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      result.unshift(current);
      current = facts.processes.find((p) => p.id === current!.parentId);
    }
    return result;
  };
  const uniqueScenarios = (ids: Iterable<string>) =>
    [...new Set(ids)].flatMap((id) =>
      scenarioById.has(id) ? [scenarioById.get(id)!] : [],
    );
  const forTask = (id: string, direction?: string) =>
    uniqueScenarios(taskScenarios.get(id) ?? []).filter(
      (s) => !direction || scenarioDirections.get(s.id)?.has(direction),
    );
  const hasImplementation = (id: string, direction?: string) =>
    forTask(id, direction).some((s) => s.implementation === "yes");
  const matchingTasks = (q: Partial<BusinessQuery>) => {
    const nodes = q.process ? descendants(q.process) : null;
    return facts.tasks.filter(
      (t) =>
        (!nodes ||
          (t.businessNodeId !== null && nodes.has(t.businessNodeId))) &&
        (!q.q ||
          `${t.name} ${t.description ?? ""}`
            .toLocaleLowerCase("ru")
            .includes(q.q.toLocaleLowerCase("ru"))) &&
        (!q.direction || forTask(t.id, q.direction).length > 0) &&
        (q.implementation !== "yes" || hasImplementation(t.id, q.direction)) &&
        (q.implementation !== "no" || !hasImplementation(t.id, q.direction)),
    );
  };
  const summary = (
    process?: string,
    direction?: string,
    taskIds?: Set<string>,
  ) => {
    const nodes = process ? descendants(process) : null;
    const tasks = facts.tasks.filter(
      (t) =>
        (!nodes ||
          (t.businessNodeId !== null && nodes.has(t.businessNodeId))) &&
        (!taskIds || taskIds.has(t.id)),
    );
    const related = uniqueScenarios(
      tasks.flatMap((t) => [...(taskScenarios.get(t.id) ?? [])]),
    );
    // Direct process scenarios remain visible even when no task link has been recorded.
    const direct = taskIds
      ? []
      : facts.scenarios.filter(
          (s) =>
            !nodes ||
            (s.businessNodeId !== null && nodes.has(s.businessNodeId)),
        );
    const scenarios = uniqueScenarios(
      [...related, ...direct].map((s) => s.id),
    ).filter((s) => !direction || scenarioDirections.get(s.id)?.has(direction));
    const covered = tasks.filter((t) => forTask(t.id, direction).length > 0);
    const implementedTasks = tasks.filter((t) =>
      hasImplementation(t.id, direction),
    );
    return {
      tasks,
      covered,
      implementedTasks,
      scenarios,
      implemented: scenarios.filter((s) => s.implementation === "yes"),
      share: tasks.length ? implementedTasks.length / tasks.length : null,
    };
  };
  const status = (id: string, direction?: string) =>
    hasImplementation(id, direction)
      ? "Есть реализация"
      : forTask(id, direction).length
        ? "Потенциал"
        : "Нет данных";
  const effectsFor = (scenarios: BusinessScenario[]) => {
    const ids = new Set(scenarios.map((s) => s.id));
    return [
      ...new Map(
        facts.effects
          .filter((e) => ids.has(e.scenarioId))
          .map((e) => [e.id, e]),
      ).values(),
    ];
  };
  const casesFor = (scenarios: BusinessScenario[]) => {
    const ids = new Set(scenarios.map((s) => s.id));
    return [
      ...new Map(
        facts.cases.filter((e) => ids.has(e.scenarioId)).map((e) => [e.id, e]),
      ).values(),
    ];
  };
  return {
    facts,
    descendants,
    ancestors,
    forTask,
    hasImplementation,
    matchingTasks,
    summary,
    status,
    effectsFor,
    casesFor,
  };
}
