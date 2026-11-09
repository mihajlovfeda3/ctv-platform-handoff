import { stableId } from "@/lib/identity";
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
  sourceProcessId?: string;
  functionalGroupId?: string;
  missingClassification?: boolean;
};
export type Task = Named & {
  businessNodeId: string | null;
  description: string | null;
  isSynthetic: boolean;
  sourceId: string | null;
};
export type BusinessScenario = Named & {
  functionalGroupId?: string | null;
  description: string;
  businessNodeId: string | null;
  implementation: string;
  isSynthetic: boolean;
};
export type Relation = { scenarioId: string; id: string };
export type BusinessFacts = {
  groups?: Named[];
  scopes?: Record<string, string[]>;
  taskScopes?: Record<string, string[]>;
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
// Presentation hierarchy only: never writes or invents scenario/task relationships.
export function functionalLandscape(facts: BusinessFacts): BusinessFacts {
  if (!facts.groups) return facts;
  const missing = stableId("business-view:missing-functional-group");
  const processes: Process[] = facts.groups.map((g) => ({
    ...g,
    parentId: null,
    description: null,
    kind: "function",
    isSynthetic: false,
    functionalGroupId: g.id,
  }));
  const scopes: Record<string, string[]> = {};
  const taskScopes: Record<string, string[]> = {};
  const ensureMissing = () => {
    if (!processes.some((p) => p.id === missing))
      processes.push({
        id: missing,
        name: "Функциональная группа не определена",
        parentId: null,
        description: null,
        kind: "function",
        isSynthetic: false,
        missingClassification: true,
      });
  };
  const add = (
    groupId: string,
    processId: string | null,
    scenarioId?: string,
    taskId?: string,
  ) => {
    let group = processes.find((p) => p.id === groupId);
    if (!group) {
      ensureMissing();
      group = processes.find((p) => p.id === missing)!;
    }
    const original = facts.processes.find((p) => p.id === processId);
    const leafId = stableId(
      `business-view:${group.id}:${original?.id ?? "unassigned-process"}`,
    );
    if (!processes.some((p) => p.id === leafId))
      processes.push({
        id: leafId,
        name: original?.name ?? "Бизнес-процесс не указан",
        parentId: group.id,
        description: original?.description ?? null,
        kind: "process",
        isSynthetic: original?.isSynthetic ?? false,
        sourceProcessId: original?.id,
        functionalGroupId: group.functionalGroupId,
        missingClassification: group.missingClassification,
      });
    for (const key of [group.id, leafId]) {
      scopes[key] ??= [];
      taskScopes[key] ??= [];
      if (scenarioId && !scopes[key].includes(scenarioId))
        scopes[key].push(scenarioId);
      if (taskId && !taskScopes[key].includes(taskId))
        taskScopes[key].push(taskId);
    }
  };
  for (const scenario of facts.scenarios) {
    const tasks = facts.taskLinks.filter((l) => l.scenarioId === scenario.id);
    add(
      scenario.functionalGroupId ?? missing,
      scenario.businessNodeId,
      scenario.id,
    );
    for (const link of tasks)
      add(
        scenario.functionalGroupId ?? missing,
        scenario.businessNodeId,
        scenario.id,
        link.id,
      );
  }
  for (const task of facts.tasks)
    if (!facts.taskLinks.some((l) => l.id === task.id)) {
      ensureMissing();
      add(missing, task.businessNodeId, undefined, task.id);
    }
  for (const p of processes) {
    scopes[p.id] ??= [];
    taskScopes[p.id] ??= [];
  }
  return { ...facts, processes, scopes, taskScopes };
}
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
  const forTask = (id: string, direction?: string, process?: string) =>
    uniqueScenarios(taskScenarios.get(id) ?? []).filter(
      (s) =>
        (!direction || scenarioDirections.get(s.id)?.has(direction)) &&
        (!process || !facts.scopes || facts.scopes[process]?.includes(s.id)),
    );
  const hasImplementation = (
    id: string,
    direction?: string,
    process?: string,
  ) => forTask(id, direction, process).some((s) => s.implementation === "yes");
  const matchingTasks = (q: Partial<BusinessQuery>) => {
    const nodes = q.process ? descendants(q.process) : null;
    return facts.tasks.filter(
      (t) =>
        (!nodes ||
          (facts.taskScopes
            ? facts.taskScopes[q.process!]?.includes(t.id)
            : t.businessNodeId !== null && nodes.has(t.businessNodeId))) &&
        (!q.q ||
          `${t.name} ${t.description ?? ""}`
            .toLocaleLowerCase("ru")
            .includes(q.q.toLocaleLowerCase("ru"))) &&
        (!q.direction || forTask(t.id, q.direction, q.process).length > 0) &&
        (q.implementation !== "yes" ||
          hasImplementation(t.id, q.direction, q.process)) &&
        (q.implementation !== "no" ||
          !hasImplementation(t.id, q.direction, q.process)),
    );
  };
  const summary = (
    process?: string,
    direction?: string,
    taskIds?: Set<string>,
    implementation: BusinessQuery["implementation"] = "all",
  ) => {
    const nodes = process ? descendants(process) : null;
    const scope = facts.scopes
      ? new Set(
          process
            ? (facts.scopes[process] ?? [])
            : facts.scenarios.map((s) => s.id),
        )
      : null;
    const tasks = facts.tasks.filter(
      (t) =>
        (!nodes ||
          (facts.taskScopes
            ? facts.taskScopes[process!]?.includes(t.id)
            : t.businessNodeId !== null && nodes.has(t.businessNodeId))) &&
        (!taskIds || taskIds.has(t.id)),
    );
    const related = uniqueScenarios(
      tasks.flatMap((t) => [...(taskScenarios.get(t.id) ?? [])]),
    );
    const direct = taskIds
      ? []
      : facts.scenarios.filter((s) =>
          scope
            ? scope.has(s.id)
            : !nodes ||
              (s.businessNodeId !== null && nodes.has(s.businessNodeId)),
        );
    const scenarios = uniqueScenarios(
      [...related, ...direct].map((s) => s.id),
    ).filter(
      (s) =>
        (!scope || scope.has(s.id)) &&
        (!direction || scenarioDirections.get(s.id)?.has(direction)) &&
        (implementation === "all" || s.implementation === implementation),
    );
    const ids = new Set(scenarios.map((s) => s.id));
    const covered = tasks.filter((t) =>
      forTask(t.id, direction).some((s) => ids.has(s.id)),
    );
    const implementedTasks = tasks.filter((t) =>
      forTask(t.id, direction).some(
        (s) => ids.has(s.id) && s.implementation === "yes",
      ),
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
  const status = (id: string, direction?: string, process?: string) =>
    hasImplementation(id, direction, process)
      ? "Есть реализация"
      : forTask(id, direction, process).length
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
    taskContexts: (id: string) =>
      facts.processes.filter(
        (p) => p.parentId && facts.taskScopes?.[p.id]?.includes(id),
      ),
  };
}
