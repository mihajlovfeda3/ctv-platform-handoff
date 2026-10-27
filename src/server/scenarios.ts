import "server-only";
import { and, eq, ilike, or, sql, count, asc, inArray } from "drizzle-orm";
import { getDatabase, type Database } from "@/db/client";
import * as s from "@/db/schema";
import {
  scenarioInput,
  scenarioQuery,
  type ScenarioInput,
} from "@/domain/scenario";

export async function createScenario(
  input: ScenarioInput,
  db: Database = getDatabase(),
) {
  const data = scenarioInput.parse(input);
  return (await db.insert(s.scenarios).values(data).returning())[0];
}
export async function listScenarios(
  raw: Record<string, unknown>,
  db: Database = getDatabase(),
) {
  const q = scenarioQuery.parse(raw);
  const conditions = [];
  if (q.q) {
    const escaped = q.q.replace(/[\\%_]/g, "\\$&");
    conditions.push(
      or(
        ilike(s.scenarios.name, `%${escaped}%`),
        ilike(s.scenarios.description, `%${escaped}%`),
        ilike(s.scenarios.externalId, `%${escaped}%`),
      ),
    );
  }
  if (q.businessNodeId)
    conditions.push(eq(s.scenarios.businessNodeId, q.businessNodeId));
  if (q.functionalGroupId)
    conditions.push(eq(s.scenarios.functionalGroupId, q.functionalGroupId));
  if (q.implementation)
    conditions.push(eq(s.scenarios.implementation, q.implementation));
  if (q.directionId)
    conditions.push(
      sql`exists (select 1 from ${s.scenarioTechnologies} st join ${s.technologyMethods} tm on tm.id=st.method_id join ${s.keyTechnologies} kt on kt.id=tm.technology_id where st.scenario_id=${s.scenarios.id} and kt.direction_id=${q.directionId})`,
    );
  for (const [metric, value] of [
    ["market_maturity", q.maturity],
    ["organizational_readiness", q.readiness],
    ["business_impact", q.impact],
  ] as const) {
    if (value)
      conditions.push(
        sql`exists (select 1 from ${s.assessments} a where a.scenario_id=${s.scenarios.id} and a.metric=${metric} and a.value=${value} and a.is_current=true and a.organizational_context=${q.context})`,
      );
  }
  const where = and(...conditions);
  // Both queries share one snapshot, so pagination and total remain consistent.
  return db.transaction(
    async (tx) => {
      const [{ total }] = await tx
        .select({ total: count() })
        .from(s.scenarios)
        .where(where);
      const items = await tx
        .select({
          id: s.scenarios.id,
          externalId: s.scenarios.externalId,
          name: s.scenarios.name,
          description: s.scenarios.description,
          implementation: s.scenarios.implementation,
          isSynthetic: s.scenarios.isSynthetic,
          business: s.businessNodes.name,
          functionalGroup: s.functionalGroups.name,
        })
        .from(s.scenarios)
        .leftJoin(
          s.businessNodes,
          eq(s.scenarios.businessNodeId, s.businessNodes.id),
        )
        .leftJoin(
          s.functionalGroups,
          eq(s.scenarios.functionalGroupId, s.functionalGroups.id),
        )
        .where(where)
        .orderBy(asc(s.scenarios.externalId), asc(s.scenarios.id))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize);
      const ratings = items.length
        ? await tx
            .select()
            .from(s.assessments)
            .where(
              and(
                inArray(
                  s.assessments.scenarioId,
                  items.map((i) => i.id),
                ),
                eq(s.assessments.isCurrent, true),
                eq(s.assessments.organizationalContext, q.context),
              ),
            )
        : [];
      return {
        items: items.map((i) => ({
          ...i,
          assessments: ratings.filter((a) => a.scenarioId === i.id),
        })),
        total,
        page: q.page,
        pageSize: q.pageSize,
        pages: Math.ceil(total / q.pageSize),
        context: q.context,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function getScenario(id: string, db: Database = getDatabase()) {
  const [item] = await db
    .select({
      scenario: s.scenarios,
      business: s.businessNodes.name,
      functionalGroup: s.functionalGroups.name,
      source: s.sources.name,
    })
    .from(s.scenarios)
    .leftJoin(
      s.businessNodes,
      eq(s.scenarios.businessNodeId, s.businessNodes.id),
    )
    .leftJoin(
      s.functionalGroups,
      eq(s.scenarios.functionalGroupId, s.functionalGroups.id),
    )
    .leftJoin(s.sources, eq(s.scenarios.sourceId, s.sources.id))
    .where(eq(s.scenarios.id, id));
  if (!item) return null;
  const ratings = await db
    .select({ assessment: s.assessments, source: s.sources.name })
    .from(s.assessments)
    .leftJoin(s.sources, eq(s.assessments.sourceId, s.sources.id))
    .where(eq(s.assessments.scenarioId, id))
    .orderBy(asc(s.assessments.metric));
  return { ...item, assessments: ratings };
}
export async function relatedObjects(id: string, db: Database = getDatabase()) {
  const [technologies, tasks, effects, cases, solutions, projects] =
    await Promise.all([
      db
        .select({
          id: s.technologyMethods.id,
          name: s.technologyMethods.name,
          technology: s.keyTechnologies.name,
          direction: s.technologyDirections.name,
        })
        .from(s.scenarioTechnologies)
        .innerJoin(
          s.technologyMethods,
          eq(s.scenarioTechnologies.methodId, s.technologyMethods.id),
        )
        .innerJoin(
          s.keyTechnologies,
          eq(s.technologyMethods.technologyId, s.keyTechnologies.id),
        )
        .innerJoin(
          s.technologyDirections,
          eq(s.keyTechnologies.directionId, s.technologyDirections.id),
        )
        .where(eq(s.scenarioTechnologies.scenarioId, id)),
      db
        .select({ id: s.taskClasses.id, name: s.taskClasses.name })
        .from(s.scenarioTasks)
        .innerJoin(s.taskClasses, eq(s.scenarioTasks.taskId, s.taskClasses.id))
        .where(eq(s.scenarioTasks.scenarioId, id)),
      db
        .select({ id: s.effectTypes.id, name: s.effectTypes.name })
        .from(s.scenarioEffects)
        .innerJoin(
          s.effectTypes,
          eq(s.scenarioEffects.effectId, s.effectTypes.id),
        )
        .where(eq(s.scenarioEffects.scenarioId, id)),
      db
        .select({ id: s.benchmarkCases.id, name: s.benchmarkCases.name })
        .from(s.scenarioCases)
        .innerJoin(
          s.benchmarkCases,
          eq(s.scenarioCases.caseId, s.benchmarkCases.id),
        )
        .where(eq(s.scenarioCases.scenarioId, id)),
      db
        .select({
          id: s.vendorSolutions.id,
          name: s.vendorSolutions.name,
          vendor: s.vendors.name,
        })
        .from(s.scenarioSolutions)
        .innerJoin(
          s.vendorSolutions,
          eq(s.scenarioSolutions.solutionId, s.vendorSolutions.id),
        )
        .innerJoin(s.vendors, eq(s.vendorSolutions.vendorId, s.vendors.id))
        .where(eq(s.scenarioSolutions.scenarioId, id)),
      db
        .select({ id: s.internalProjects.id, name: s.internalProjects.name })
        .from(s.scenarioProjects)
        .innerJoin(
          s.internalProjects,
          eq(s.scenarioProjects.projectId, s.internalProjects.id),
        )
        .where(eq(s.scenarioProjects.scenarioId, id)),
    ]);
  return { technologies, tasks, effects, cases, solutions, projects };
}
export async function getReferences(db: Database = getDatabase()) {
  const [directions, technologies, methods, business, groups] =
    await Promise.all([
      db
        .select()
        .from(s.technologyDirections)
        .orderBy(s.technologyDirections.name),
      db.select().from(s.keyTechnologies).orderBy(s.keyTechnologies.name),
      db.select().from(s.technologyMethods).orderBy(s.technologyMethods.name),
      db.select().from(s.businessNodes).orderBy(s.businessNodes.name),
      db.select().from(s.functionalGroups).orderBy(s.functionalGroups.name),
    ]);
  return { directions, technologies, methods, business, groups };
}
export type ScenarioList = Awaited<ReturnType<typeof listScenarios>>;
