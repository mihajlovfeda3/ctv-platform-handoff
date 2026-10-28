import "server-only";
import { and, sql, asc } from "drizzle-orm";
import { getDatabase, type Database } from "@/db/client";
import * as s from "@/db/schema";
import { scenarioQuery } from "@/domain/scenario";
import { scenarioConditions } from "./scenarios";
export async function scenarioAnalytics(
  raw: Record<string, unknown>,
  db: Database = getDatabase(),
) {
  const q = scenarioQuery.parse(raw);
  return db.transaction(
    async (tx) => {
      const score = (metric: string) =>
        sql<
          number | null
        >`(select a.value from ${s.assessments} a where a.scenario_id=${sql.raw('"scenarios"."id"')} and a.metric=${metric} and a.is_current=true and a.organizational_context=${q.context})`;
      const rows = await tx
        .select({
          id: s.scenarios.id,
          name: s.scenarios.name,
          externalId: s.scenarios.externalId,
          implementation: s.scenarios.implementation,
          maturity: score("market_maturity"),
          readiness: score("organizational_readiness"),
          impact: score("business_impact"),
          directions: sql<
            { id: string; name: string }[]
          >`coalesce((select jsonb_agg(distinct jsonb_build_object('id',d.id,'name',d.name)) from ${s.scenarioTechnologies} st join ${s.technologyMethods} m on m.id=st.method_id join ${s.keyTechnologies} t on t.id=m.technology_id join ${s.technologyDirections} d on d.id=t.direction_id where st.scenario_id=${sql.raw('"scenarios"."id"')} ${q.directionId ? sql`and d.id=${q.directionId}` : sql``}),'[]'::jsonb)`,
        })
        .from(s.scenarios)
        .where(and(...scenarioConditions(q)))
        .orderBy(asc(s.scenarios.id));
      const directions = await tx
        .select({
          id: s.technologyDirections.id,
          name: s.technologyDirections.name,
        })
        .from(s.technologyDirections)
        .where(
          sql`(${s.technologyDirections.isSynthetic}=false or ${s.technologyDirections.description}='ctv-demo-classification-v2') or ${s.technologyDirections.id} in (select distinct t.direction_id from ${s.keyTechnologies} t join ${s.technologyMethods} m on m.technology_id=t.id join ${s.scenarioTechnologies} st on st.method_id=m.id)`,
        )
        .orderBy(asc(s.technologyDirections.name));
      return { rows, directions, total: rows.length, context: q.context };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
