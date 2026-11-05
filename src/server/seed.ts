import { seedDemoClassification } from "./demo-classification";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";
import { generateDataset } from "../../scripts/synthetic";
export async function seedDatabase(db: Database, size = 80, seed?: number) {
  const d = generateDataset(size, seed);
  const classification = await db.transaction(async (tx) => {
    await tx.insert(s.sources).values(d.sources).onConflictDoNothing();
    await tx
      .insert(s.organizations)
      .values(d.organizations)
      .onConflictDoNothing();
    await tx.insert(s.functionalGroups).values(d.groups).onConflictDoNothing();
    // Parents first: a later database can retain stricter hierarchy triggers.
    for (const kind of ["direction", "process", "stage"])
      await tx
        .insert(s.businessNodes)
        .values(d.business.filter((n) => n.kind === kind))
        .onConflictDoNothing();
    await tx.insert(s.taskClasses).values(d.tasks).onConflictDoNothing();
    await tx
      .insert(s.technologyDirections)
      .values(d.directions)
      .onConflictDoNothing();
    await tx
      .insert(s.keyTechnologies)
      .values(d.technologies)
      .onConflictDoNothing();
    await tx
      .insert(s.technologyMethods)
      .values(d.methods)
      .onConflictDoNothing();
    await tx.insert(s.vendors).values(d.vendors).onConflictDoNothing();
    await tx
      .insert(s.vendorSolutions)
      .values(d.solutions)
      .onConflictDoNothing();
    await tx.insert(s.benchmarkCases).values(d.cases).onConflictDoNothing();
    await tx
      .insert(s.internalProjects)
      .values(d.projects)
      .onConflictDoNothing();
    await tx.insert(s.effectTypes).values(d.effects).onConflictDoNothing();
    const createdIds = new Set<string>();
    for (let i = 0; i < d.scenarios.length; i += 250) {
      const inserted = await tx
        .insert(s.scenarios)
        .values(d.scenarios.slice(i, i + 250))
        .onConflictDoNothing()
        .returning({ id: s.scenarios.id });
      inserted.forEach((row) => createdIds.add(row.id));
    }
    const fresh = <T extends { scenarioId: string }>(rows: T[]) =>
      rows.filter((row) => createdIds.has(row.scenarioId));
    const pending = {
      assessments: fresh(d.assessments),
      scenarioTechnologies: fresh(d.scenarioTechnologies),
      scenarioTasks: fresh(d.scenarioTasks),
      scenarioEffects: fresh(d.scenarioEffects),
      scenarioCases: fresh(d.scenarioCases),
      scenarioSolutions: fresh(d.scenarioSolutions),
      scenarioProjects: fresh(d.scenarioProjects),
    };
    for (let i = 0; i < pending.assessments.length; i += 250)
      await tx
        .insert(s.assessments)
        .values(pending.assessments.slice(i, i + 250))
        .onConflictDoNothing();
    for (let i = 0; i < pending.scenarioTechnologies.length; i += 250)
      await tx
        .insert(s.scenarioTechnologies)
        .values(pending.scenarioTechnologies.slice(i, i + 250))
        .onConflictDoNothing();
    for (let i = 0; i < pending.scenarioTasks.length; i += 250) {
      await tx
        .insert(s.scenarioTasks)
        .values(pending.scenarioTasks.slice(i, i + 250))
        .onConflictDoNothing();
      await tx
        .insert(s.scenarioEffects)
        .values(pending.scenarioEffects.slice(i, i + 250))
        .onConflictDoNothing();
    }
    if (pending.scenarioCases.length)
      await tx
        .insert(s.scenarioCases)
        .values(pending.scenarioCases)
        .onConflictDoNothing();
    if (pending.scenarioSolutions.length)
      await tx
        .insert(s.scenarioSolutions)
        .values(pending.scenarioSolutions)
        .onConflictDoNothing();
    if (pending.scenarioProjects.length)
      await tx
        .insert(s.scenarioProjects)
        .values(pending.scenarioProjects)
        .onConflictDoNothing();
    return seedDemoClassification(tx);
  });
  return {
    classification,
    scenarios: d.scenarios.length,
    seed: seed ?? 20261027,
    synthetic: true,
  };
}
