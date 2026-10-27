import "server-only";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";
import { stableId } from "@/lib/identity";
import type { PreparedImport } from "@/features/import/parse";

/** Atomic create-only import: existing origin+ID is skipped, never overwritten implicitly. */
export async function applyImport(db: Database, prepared: PreparedImport) {
  if (!prepared.valid)
    throw new Error("Импорт содержит ошибки; запись отклонена целиком");
  return db.transaction(async (tx) => {
    const sourceId = stableId(`import-source:${prepared.options.namespace}`),
      batchId = randomUUID();
    let created = 0,
      skipped = 0;
    await tx
      .insert(s.sources)
      .values({
        id: sourceId,
        name: prepared.options.sourceName,
        kind: "structured-import",
        isSynthetic: prepared.options.synthetic,
      })
      .onConflictDoNothing();
    await tx
      .insert(s.importBatches)
      .values({
        id: batchId,
        namespace: prepared.options.namespace,
        format: prepared.format,
        sourceId,
        mapping: JSON.stringify(prepared.mapping),
      });
    for (const row of prepared.rows) {
      const [existing] = await tx
        .select({ id: s.scenarios.id })
        .from(s.scenarios)
        .where(
          and(
            eq(s.scenarios.originNamespace, prepared.options.namespace),
            eq(s.scenarios.externalId, row.data.externalId),
          ),
        );
      if (existing) {
        skipped++;
        continue;
      }
      const [inserted] = await tx
        .insert(s.scenarios)
        .values({ ...row.data, sourceId })
        .onConflictDoNothing({
          target: [s.scenarios.originNamespace, s.scenarios.externalId],
        })
        .returning({ id: s.scenarios.id });
      if (!inserted) {
        skipped++;
        continue;
      }
      for (const [metric, value] of Object.entries(row.ratings))
        await tx
          .insert(s.assessments)
          .values({
            scenarioId: inserted.id,
            metric: metric as keyof typeof row.ratings,
            value,
            sourceId,
            assessedAt: new Date(prepared.options.assessedAt!),
            organizationalContext: prepared.options.context,
            isSynthetic: prepared.options.synthetic,
          });
      if (row.methodIds.length)
        await tx
          .insert(s.scenarioTechnologies)
          .values(
            row.methodIds.map((methodId) => ({
              scenarioId: inserted.id,
              methodId,
              sourceId,
              isSynthetic: prepared.options.synthetic,
            })),
          );
      await tx
        .insert(s.importRows)
        .values({
          batchId,
          rowNumber: row.row,
          scenarioId: inserted.id,
          raw: JSON.stringify(row.raw),
          warnings: JSON.stringify(
            prepared.diagnostics.filter((d) => d.row === row.row),
          ),
        });
      created++;
    }
    return { batchId, created, skipped, diagnostics: prepared.diagnostics };
  });
}
