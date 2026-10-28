import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";
import { stableId } from "@/lib/identity";

export const originalDirections = [
  "AR/VR, естественные интерфейсы и носимые устройства",
  "Искусственный интеллект, цифровые двойники и вычисления на новых методах",
  "Средства роботизации и управления процессами",
  "Средства коллаборации",
  "Блокчейн и смарт-контракты",
  "Промышленный интернет",
  "Робототехника и 3D-печать",
  "БВС",
];
export const demoId = (key: string) =>
  stableId(`ctv-demo-classification-v2:${key}`);
// Literal names; all identifiers and scenario assignments are demonstrational.
export async function seedDemoClassification(db: Database) {
  return db.transaction(async (tx) => {
    const sourceId = demoId("source");
    await tx
      .insert(s.sources)
      .values({
        id: sourceId,
        name: "Демонстрационная классификация v2: названия из референсов; связи вымышлены",
        kind: "synthetic",
        isSynthetic: true,
      })
      .onConflictDoNothing();
    const meta = (key: string, name: string) => ({
      id: demoId(key),
      name,
      sourceId,
      isSynthetic: true,
      description: "ctv-demo-classification-v2",
    });
    const business = ["Управление имуществом", "Переработка"].map((name, i) =>
      meta(`business:${i}`, name),
    );
    await tx
      .insert(s.businessDirections)
      .values(business)
      .onConflictDoNothing();
    for (const [i, name] of originalDirections.entries()) {
      await tx
        .insert(s.technologyDirections)
        .values(meta(`direction:${i}`, name))
        .onConflictDoNothing();
      await tx
        .insert(s.keyTechnologies)
        .values({
          ...meta(`technology:${i}`, `Демонстрационная технология ${i + 1}`),
          directionId: demoId(`direction:${i}`),
        })
        .onConflictDoNothing();
      await tx
        .insert(s.technologyMethods)
        .values({
          ...meta(`method:${i}`, `Демонстрационный метод ${i + 1}`),
          technologyId: demoId(`technology:${i}`),
        })
        .onConflictDoNothing();
    }
    // Only owned synthetic v1 scenarios are reclassified. Never touch imported/real rows.
    const owned = (
      await tx
        .select()
        .from(s.scenarios)
        .where(eq(s.scenarios.isSynthetic, true))
    )
      .filter((row) => row.originNamespace.startsWith("synthetic-v1-"))
      .sort(
        (a, b) =>
          a.externalId.localeCompare(b.externalId) || a.id.localeCompare(b.id),
      );
    for (let i = 0; i < owned.length; i++) {
      const row = owned[i];
      const prior = await tx
        .select()
        .from(s.scenarioClassification)
        .where(eq(s.scenarioClassification.scenarioId, row.id));
      if (prior.some((p) => !p.isSynthetic || p.sourceId !== sourceId))
        continue;
      await tx
        .insert(s.scenarioClassification)
        .values({
          scenarioId: row.id,
          businessDirectionId: business[i % business.length].id,
          sourceId,
          isSynthetic: true,
        })
        .onConflictDoNothing();
      // Preserve non-synthetic and externally supplied links, including on synthetic scenarios.
      await tx
        .delete(s.scenarioTechnologies)
        .where(
          and(
            eq(s.scenarioTechnologies.scenarioId, row.id),
            eq(s.scenarioTechnologies.isSynthetic, true),
            inArray(s.scenarioTechnologies.sourceId, [row.sourceId!, sourceId]),
          ),
        );
      await tx
        .insert(s.scenarioTechnologies)
        .values({
          scenarioId: row.id,
          methodId: demoId(`method:${i % 8}`),
          sourceId,
          isSynthetic: true,
        })
        .onConflictDoNothing();
    }
    return {
      version: 2,
      technologyDirections: 8,
      businessDirections: 2,
      organizationalBlocks: 0,
      scenarios: owned.length,
    };
  });
}
