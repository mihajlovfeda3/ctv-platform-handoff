import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";
import {
  organizationalBlockNames,
  businessDirectionNames,
} from "@/domain/terminology";
import {
  demoId,
  functionalGroupId,
  originalDirections,
} from "@/domain/ctv-reference";
import { stableId } from "@/lib/identity";
import {
  generateDataset,
  generateLegacyDataset,
} from "../../scripts/synthetic";
import { scenarioProfile } from "../../scripts/scenario-profiles";

export { demoId, originalDirections } from "@/domain/ctv-reference";
type SeedWriter = Pick<Database, "insert" | "select" | "update" | "delete">;

// Called inside the seed transaction. Only recognized generator output is upgraded.
export async function seedDemoClassification(tx: SeedWriter) {
  const sourceId = demoId("source");
  await tx
    .insert(s.sources)
    .values({
      id: sourceId,
      name: "Демонстрационная классификация: терминология предоставлена пользователем; связи вымышлены",
      kind: "synthetic",
      isSynthetic: true,
    })
    .onConflictDoNothing();
  const meta = (id: string, name: string) => ({
    id,
    name,
    sourceId,
    isSynthetic: true,
    description: "ctv-demo-classification-v2",
  });
  const business = businessDirectionNames.map((name) =>
    meta(functionalGroupId(name), name),
  );
  await tx.insert(s.businessDirections).values(business).onConflictDoNothing();
  await tx
    .insert(s.functionalGroups)
    .values(
      business.map((row) => ({
        ...row,
        description: "ctv-functional-groups-v1",
      })),
    )
    .onConflictDoNothing();
  await tx
    .insert(s.organizationalBlocks)
    .values(
      organizationalBlockNames.map((name) =>
        meta(demoId(`block:${name}`), name),
      ),
    )
    .onConflictDoNothing();
  await tx
    .insert(s.technologyDirections)
    .values(
      originalDirections.map((name, i) => meta(demoId(`direction:${i}`), name)),
    )
    .onConflictDoNothing();

  const rows = await tx
    .select()
    .from(s.scenarios)
    .where(eq(s.scenarios.isSynthetic, true));
  const owned = rows.flatMap((row) => {
    const namespace = /^synthetic-v1-(-?\d+)$/.exec(row.originNamespace);
    const ordinal = /^SYN-(\d{4,5})$/.exec(row.externalId);
    if (!namespace || !ordinal) return [];
    const seed = Number(namespace[1]),
      index = Number(ordinal[1]) - 1;
    if (
      index < 0 ||
      index >= 10000 ||
      row.id !== stableId(`synthetic-v1:${seed}:scenario:${index}`) ||
      row.sourceId !== stableId(`synthetic-v1:${seed}:source`)
    )
      return [];
    return [{ row, seed, index }];
  });
  const datasets = new Map<
    number,
    {
      legacy: ReturnType<typeof generateLegacyDataset>;
      current: ReturnType<typeof generateDataset>;
    }
  >();
  for (const seed of new Set(owned.map((entry) => entry.seed))) {
    const size = Math.max(
      ...owned
        .filter((entry) => entry.seed === seed)
        .map((entry) => entry.index + 1),
    );
    datasets.set(seed, {
      legacy: generateLegacyDataset(size, seed),
      current: generateDataset(size, seed),
    });
  }
  const classifications = await tx.select().from(s.scenarioClassification);
  const priorById = new Map(
    classifications.map((row) => [row.scenarioId, row]),
  );
  const eligible: typeof owned = [];
  let upgraded = 0,
    preserved = 0;
  for (const { row, seed, index } of owned) {
    const dataset = datasets.get(seed)!;
    const legacy = dataset.legacy.scenarios[index];
    const current = dataset.current.scenarios[index];
    const prior = priorById.get(row.id);
    const sameFields = (expected: typeof legacy | typeof current) =>
      row.description === expected.description &&
      row.businessNodeId === expected.businessNodeId &&
      row.functionalGroupId === expected.functionalGroupId &&
      row.businessChallenge === expected.businessChallenge &&
      row.rationale === expected.rationale &&
      row.projectProposal === expected.projectProposal;
    const legacyName =
      row.name === legacy.name ||
      row.name === `${legacy.name} · ${String(index + 1).padStart(3, "0")}`;
    const recognizedLegacy =
      legacyName &&
      sameFields(legacy) &&
      row.businessEffect === null &&
      row.businessChallengeDescription === null;
    const recognizedCurrent =
      row.name === current.name &&
      sameFields(current) &&
      row.businessEffect === current.businessEffect &&
      row.businessChallengeDescription === current.businessChallengeDescription;
    if (
      (!recognizedLegacy && !recognizedCurrent) ||
      (prior && (!prior.isSynthetic || prior.sourceId !== sourceId))
    ) {
      preserved++;
      continue;
    }
    if (recognizedLegacy) {
      await tx
        .update(s.scenarios)
        .set({
          name: current.name,
          description: current.description,
          functionalGroupId: current.functionalGroupId,
          businessNodeId: current.businessNodeId,
          businessChallenge: current.businessChallenge,
          businessChallengeDescription: current.businessChallengeDescription,
          businessEffect: current.businessEffect,
          rationale: current.rationale,
          projectProposal: current.projectProposal,
        })
        .where(eq(s.scenarios.id, row.id));
      upgraded++;
    }
    eligible.push({ row, seed, index });
  }
  for (let offset = 0; offset < eligible.length; offset += 250) {
    await tx
      .insert(s.scenarioClassification)
      .values(
        eligible.slice(offset, offset + 250).map(({ row, index }) => ({
          scenarioId: row.id,
          businessDirectionId: scenarioProfile(index).groupId,
          blockId: null,
          sourceId,
          isSynthetic: true,
        })),
      )
      .onConflictDoUpdate({
        target: s.scenarioClassification.scenarioId,
        set: { businessDirectionId: sql`excluded.business_direction_id` },
        setWhere: and(
          eq(s.scenarioClassification.isSynthetic, true),
          eq(s.scenarioClassification.sourceId, sourceId),
        ),
      });
  }
  type LinkGroup = { target: string; sourceId: string; ids: string[] };
  const methods = new Map<string, LinkGroup>(),
    tasks = new Map<string, LinkGroup>(),
    effects = new Map<string, LinkGroup>();
  for (const { row, seed, index } of eligible) {
    const profile = scenarioProfile(index);
    for (const [map, target] of [
      [methods, profile.methodId],
      [tasks, profile.taskId],
      [effects, datasets.get(seed)!.current.scenarioEffects[index].effectId],
    ] as const) {
      const key = `${target}:${row.sourceId}`;
      const group = map.get(key) ?? {
        target,
        sourceId: row.sourceId!,
        ids: [],
      };
      group.ids.push(row.id);
      map.set(key, group);
    }
  }
  for (const [table, column, targets] of [
    [s.scenarioTechnologies, s.scenarioTechnologies.methodId, methods],
    [s.scenarioTasks, s.scenarioTasks.taskId, tasks],
    [s.scenarioEffects, s.scenarioEffects.effectId, effects],
  ] as const)
    for (const { target, ids, sourceId: generatorSource } of targets.values())
      await tx
        .delete(table)
        .where(
          and(
            inArray(table.scenarioId, ids),
            eq(table.isSynthetic, true),
            inArray(table.sourceId, [generatorSource, sourceId]),
            sql`${column} <> ${target}`,
          ),
        );
  for (let offset = 0; offset < eligible.length; offset += 250) {
    const batch = eligible.slice(offset, offset + 250);
    await tx
      .insert(s.scenarioTechnologies)
      .values(
        batch.map(({ row, index }) => ({
          scenarioId: row.id,
          methodId: scenarioProfile(index).methodId,
          sourceId: row.sourceId,
          isSynthetic: true,
        })),
      )
      .onConflictDoNothing();
    await tx
      .insert(s.scenarioTasks)
      .values(
        batch.map(({ row, index }) => ({
          scenarioId: row.id,
          taskId: scenarioProfile(index).taskId,
          sourceId: row.sourceId,
          isSynthetic: true,
        })),
      )
      .onConflictDoNothing();
    await tx
      .insert(s.scenarioEffects)
      .values(
        batch.map(({ row, seed, index }) => ({
          scenarioId: row.id,
          effectId: datasets.get(seed)!.current.scenarioEffects[index].effectId,
          sourceId: row.sourceId,
          isSynthetic: true,
        })),
      )
      .onConflictDoNothing();
  }
  return {
    version: 4,
    technologyDirections: 8,
    businessDirections: business.length,
    organizationalBlocks: organizationalBlockNames.length,
    scenarios: owned.length,
    upgraded,
    preserved,
  };
}
