import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDatabase, type Database } from "@/db/client";
import * as s from "@/db/schema";
import {
  createBusinessIndex,
  type BusinessFacts,
} from "@/features/business/model";
export async function getBusinessData(
  context: string,
  db: Database = getDatabase(),
) {
  return db.transaction(
    async (tx) => {
      const [
        processes,
        tasks,
        scenarios,
        directions,
        taskLinks,
        directionLinks,
        effects,
        cases,
        scores,
        sources,
      ] = await Promise.all([
        tx.select().from(s.businessNodes),
        tx.select().from(s.taskClasses),
        tx
          .select({
            id: s.scenarios.id,
            name: s.scenarios.name,
            description: s.scenarios.description,
            businessNodeId: s.scenarios.businessNodeId,
            implementation: s.scenarios.implementation,
            isSynthetic: s.scenarios.isSynthetic,
          })
          .from(s.scenarios),
        tx
          .select({
            id: s.technologyDirections.id,
            name: s.technologyDirections.name,
          })
          .from(s.technologyDirections)
          .where(
            sql`(${s.technologyDirections.isSynthetic}=false or ${s.technologyDirections.description}='ctv-demo-classification-v2') or ${s.technologyDirections.id} in (select distinct t.direction_id from ${s.keyTechnologies} t join ${s.technologyMethods} m on m.technology_id=t.id join ${s.scenarioTechnologies} st on st.method_id=m.id)`,
          ),
        tx
          .select({
            id: s.scenarioTasks.taskId,
            scenarioId: s.scenarioTasks.scenarioId,
          })
          .from(s.scenarioTasks),
        tx
          .select({
            id: s.keyTechnologies.directionId,
            scenarioId: s.scenarioTechnologies.scenarioId,
          })
          .from(s.scenarioTechnologies)
          .innerJoin(
            s.technologyMethods,
            eq(s.technologyMethods.id, s.scenarioTechnologies.methodId),
          )
          .innerJoin(
            s.keyTechnologies,
            eq(s.keyTechnologies.id, s.technologyMethods.technologyId),
          ),
        tx
          .select({
            id: s.effectTypes.id,
            name: s.effectTypes.name,
            scenarioId: s.scenarioEffects.scenarioId,
          })
          .from(s.scenarioEffects)
          .innerJoin(
            s.effectTypes,
            eq(s.effectTypes.id, s.scenarioEffects.effectId),
          ),
        tx
          .select({
            id: s.benchmarkCases.id,
            name: s.benchmarkCases.name,
            description: s.benchmarkCases.description,
            implementationYear: s.benchmarkCases.implementationYear,
            isSynthetic: s.benchmarkCases.isSynthetic,
            scenarioId: s.scenarioCases.scenarioId,
          })
          .from(s.scenarioCases)
          .innerJoin(
            s.benchmarkCases,
            eq(s.benchmarkCases.id, s.scenarioCases.caseId),
          ),
        tx
          .select({
            scenarioId: s.assessments.scenarioId,
            metric: s.assessments.metric,
            value: s.assessments.value,
          })
          .from(s.assessments)
          .where(
            and(
              eq(s.assessments.isCurrent, true),
              eq(s.assessments.organizationalContext, context),
            ),
          ),
        tx.select({ id: s.sources.id, name: s.sources.name }).from(s.sources),
      ]);
      const facts: BusinessFacts = {
        processes,
        tasks,
        scenarios,
        directions,
        taskLinks,
        directionLinks,
        effects,
        cases,
        scores,
        sources,
      };
      facts.processes.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      facts.tasks.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      facts.directions.sort((a, b) => a.name.localeCompare(b.name, "ru"));
      return createBusinessIndex(facts);
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
