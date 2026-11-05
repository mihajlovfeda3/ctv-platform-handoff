import "dotenv/config";
import { sql } from "drizzle-orm";
import { createDatabase } from "../src/db/client";
import { stableId } from "../src/lib/identity";
import { scenarioProfile } from "./scenario-profiles";

const { db, pool } = createDatabase(process.env.DATABASE_URL!);
try {
  const classification = await db.execute(sql`
    select projection.scenario_id, projection.conflict, projection.unmapped,
      raw_group.name as legacy_functional_group, direction.name as legacy_business_direction
    from scenario_functional_groups projection
    join scenarios scenario on scenario.id = projection.scenario_id
    left join functional_groups raw_group on raw_group.id = scenario.functional_group_id
    left join scenario_classification classification on classification.scenario_id = scenario.id
    left join business_directions direction on direction.id = classification.business_direction_id
    where projection.conflict or projection.unmapped
  `);
  const rows = await db.execute(sql`
    select scenario.id, scenario.external_id, scenario.origin_namespace,
      scenario.source_id, scenario.name, scenario.description,
      scenario.business_effect, scenario.business_challenge_description,
      coalesce((select json_agg(method_id) from scenario_technologies link
        where link.scenario_id = scenario.id), '[]'::json) as methods
    from scenarios scenario where scenario.is_synthetic
  `);
  const generated = rows.rows.filter((row) => {
    const match = /^synthetic-v1-(-?\d+)$/.exec(String(row.origin_namespace));
    const index = Number(String(row.external_id).replace(/^SYN-/, "")) - 1;
    return (
      match &&
      row.id === stableId(`synthetic-v1:${match[1]}:scenario:${index}`) &&
      row.source_id === stableId(`synthetic-v1:${match[1]}:source`)
    );
  });
  const contentIssues = generated.flatMap((row) => {
    const profile = scenarioProfile(
      Number(String(row.external_id).slice(4)) - 1,
    );
    const methods = row.methods as string[];
    const problems = [
      !String(row.description).trim() ||
      String(row.description).includes("проверки каталога")
        ? "description"
        : null,
      row.name !== profile.name ? "name" : null,
      !methods.includes(profile.methodId) ? "technology" : null,
      row.business_effect !== profile.effect ? "businessEffect" : null,
      row.business_challenge_description !== profile.problem
        ? "businessChallengeDescription"
        : null,
    ].filter(Boolean);
    return problems.length ? [{ id: row.id, problems }] : [];
  });
  const duplicateApplications = await db.execute(sql`
    select count(*)::integer as count from (
      select name, description from scenarios where is_synthetic
      group by name, description having count(*) > 1
    ) duplicates
  `);
  // The sources define OG levels but do not state a status-calculation threshold.
  const statusReadiness = await db.execute(sql`
    select scenario.implementation, assessment.value as readiness, count(*)::integer as count
    from scenarios scenario left join scenario_assessments assessment
      on assessment.scenario_id = scenario.id and assessment.metric = 'organizational_readiness'
      and assessment.is_current and assessment.organizational_context = 'synthetic-lab'
    group by scenario.implementation, assessment.value
    order by scenario.implementation, assessment.value
  `);
  console.log(
    JSON.stringify(
      {
        generatedScenarios: generated.length,
        classificationIssues: classification.rows,
        contentIssues,
        duplicateApplications: duplicateApplications.rows[0].count,
        statusReadiness: statusReadiness.rows,
        limitations: [
          "Статус реализации не пересчитывается по ОГ: формальное правило в источниках отсутствует.",
          "Подписи радара сопоставлены с двумя вариантами названий направлений в XLSX.",
          "Cнабжение с латинской C сопоставлено с существующим значением Снабжение.",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
