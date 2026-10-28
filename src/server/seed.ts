import { seedDemoClassification } from "./demo-classification";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";
import { generateDataset } from "../../scripts/synthetic";
export async function seedDatabase(db: Database, size = 80, seed?: number) {
  const d = generateDataset(size, seed);
  await db.transaction(async (tx) => {
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
    for (let i = 0; i < d.scenarios.length; i += 250)
      await tx
        .insert(s.scenarios)
        .values(d.scenarios.slice(i, i + 250))
        .onConflictDoNothing();
    for (let i = 0; i < d.assessments.length; i += 250)
      await tx
        .insert(s.assessments)
        .values(d.assessments.slice(i, i + 250))
        .onConflictDoNothing();
    for (let i = 0; i < d.scenarioTechnologies.length; i += 250)
      await tx
        .insert(s.scenarioTechnologies)
        .values(d.scenarioTechnologies.slice(i, i + 250))
        .onConflictDoNothing();
    for (let i = 0; i < d.scenarios.length; i += 250) {
      await tx
        .insert(s.scenarioTasks)
        .values(d.scenarioTasks.slice(i, i + 250))
        .onConflictDoNothing();
      await tx
        .insert(s.scenarioEffects)
        .values(d.scenarioEffects.slice(i, i + 250))
        .onConflictDoNothing();
    }
    if (d.scenarioCases.length)
      await tx
        .insert(s.scenarioCases)
        .values(d.scenarioCases)
        .onConflictDoNothing();
    if (d.scenarioSolutions.length)
      await tx
        .insert(s.scenarioSolutions)
        .values(d.scenarioSolutions)
        .onConflictDoNothing();
    if (d.scenarioProjects.length)
      await tx
        .insert(s.scenarioProjects)
        .values(d.scenarioProjects)
        .onConflictDoNothing();
  });
  const classification = await seedDemoClassification(db);
  return {
    classification,
    scenarios: d.scenarios.length,
    seed: seed ?? 20261027,
    synthetic: true,
  };
}
