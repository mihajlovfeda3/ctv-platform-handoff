import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as s from "../src/db/schema";
import type { Database } from "../src/db/client";
import { getBusinessData } from "../src/server/business";
import {
  createBusinessIndex,
  businessQuery,
  businessHref,
  taskHref,
  type BusinessFacts,
} from "../src/features/business/model";
import { stableId } from "../src/lib/identity";
const id = (key: string) => stableId(`business-test:${key}`);
function fixture(): BusinessFacts {
  return {
    processes: [
      {
        id: id("root"),
        name: "Процесс",
        parentId: null,
        description: null,
        kind: "direction",
        isSynthetic: true,
      },
      {
        id: id("child"),
        name: "Подпроцесс",
        parentId: id("root"),
        description: null,
        kind: "process",
        isSynthetic: true,
      },
      {
        id: id("empty"),
        name: "Без задач",
        parentId: null,
        description: null,
        kind: "process",
        isSynthetic: true,
      },
    ],
    tasks: ["one", "two", "none"].map((key) => ({
      id: id(key),
      name: key,
      description: key === "one" ? "длинное описание" : "",
      businessNodeId: id("child"),
      isSynthetic: true,
      sourceId: null,
    })),
    scenarios: [
      {
        id: id("yes"),
        name: "A",
        description: "",
        businessNodeId: id("child"),
        implementation: "yes",
        isSynthetic: true,
      },
      {
        id: id("no"),
        name: "B",
        description: "",
        businessNodeId: id("child"),
        implementation: "no",
        isSynthetic: true,
      },
    ],
    directions: [{ id: id("tech"), name: "Направление" }],
    taskLinks: [
      { id: id("one"), scenarioId: id("yes") },
      { id: id("one"), scenarioId: id("yes") },
      { id: id("two"), scenarioId: id("no") },
    ],
    directionLinks: [
      { id: id("tech"), scenarioId: id("yes") },
      { id: id("tech"), scenarioId: id("yes") },
      { id: id("tech"), scenarioId: id("no") },
    ],
    effects: [
      { id: id("effect"), name: "Эффект", scenarioId: id("yes") },
      { id: id("effect"), name: "Эффект", scenarioId: id("no") },
    ],
    cases: [
      {
        id: id("case"),
        name: "Кейс",
        scenarioId: id("yes"),
        description: null,
        implementationYear: null,
        isSynthetic: true,
      },
      {
        id: id("case"),
        name: "Кейс",
        scenarioId: id("no"),
        description: null,
        implementationYear: null,
        isSynthetic: true,
      },
    ],
    scores: [],
    sources: [],
  };
}
describe("Business aggregation", () => {
  it("counts distinct scenarios and tasks across descendants and multiple technology links", () => {
    const x = createBusinessIndex(fixture());
    const cell = x.summary(id("root"), id("tech"));
    expect(cell.tasks).toHaveLength(3);
    expect(cell.covered).toHaveLength(2);
    expect(cell.scenarios).toHaveLength(2);
    expect(cell.implemented).toHaveLength(1);
    expect(cell.implementedTasks).toHaveLength(1);
    expect(cell.share).toBe(1 / 3);
    expect([...x.descendants(id("root"))]).toEqual([id("root"), id("child")]);
    expect(x.ancestors(id("child")).map((p) => p.id)).toEqual([
      id("root"),
      id("child"),
    ]);
  });
  it("distinguishes potential from no data without inventing a scenario status", () => {
    const x = createBusinessIndex(fixture());
    expect(x.status(id("one"))).toBe("Есть реализация");
    expect(x.status(id("two"))).toBe("Потенциал");
    expect(x.status(id("none"))).toBe("Нет данных");
    expect(x.summary(id("empty")).share).toBeNull();
    expect(x.summary(id("empty")).scenarios).toHaveLength(0);
  });
  it("searches descriptions, keeps unassigned tasks, and filters actual realization", () => {
    const f = fixture();
    f.tasks.push({ ...f.tasks[0], id: id("unassigned"), businessNodeId: null });
    const x = createBusinessIndex(f);
    expect(x.matchingTasks({ q: "описание" })).toHaveLength(2);
    expect(
      x
        .matchingTasks({ process: id("root"), implementation: "yes" })
        .map((t) => t.id),
    ).toEqual([id("one")]);
    expect(
      x.matchingTasks({ process: id("root"), implementation: "no" }),
    ).toHaveLength(2);
    expect(x.matchingTasks({ direction: id("tech") })).toHaveLength(2);
  });
  it("deduplicates effects/cases and retains direct scenarios without fictional task links", () => {
    const f = fixture();
    f.taskLinks = [];
    const x = createBusinessIndex(f);
    const r = x.summary(id("root"));
    expect(r.scenarios).toHaveLength(2);
    expect(r.covered).toHaveLength(0);
    expect(x.effectsFor(r.scenarios)).toHaveLength(1);
    expect(x.casesFor(r.scenarios)).toHaveLength(1);
  });
  it("contains cycles and handles empty data", () => {
    const f = fixture();
    f.processes[0].parentId = id("child");
    const x = createBusinessIndex(f);
    expect(x.descendants(id("root")).size).toBe(2);
    expect(x.ancestors(id("child"))).toHaveLength(2);
    expect(
      createBusinessIndex({
        ...f,
        tasks: [],
        scenarios: [],
        taskLinks: [],
      }).summary().share,
    ).toBeNull();
  });
  it("preserves applicable filters and the coverage cell when returning from a task", () => {
    const q = businessQuery.parse({
      process: id("root"),
      direction: id("tech"),
      implementation: "yes",
      cell: id("child"),
      cellDirection: id("tech"),
    });
    const link = taskHref(id("one"), "coverage", q);
    const parsed = businessQuery.parse(
      Object.fromEntries(new URL(link, "http://test").searchParams),
    );
    expect(parsed.process).toBe(q.process);
    expect(parsed.cell).toBe(q.cell);
    expect(parsed.from).toBe("coverage");
    const back = businessHref(parsed.from, parsed, {
      cell: parsed.cell,
      cellDirection: parsed.cellDirection,
    });
    expect(back).toContain(`cell=${q.cell}`);
    expect(businessHref("tasks", q)).not.toContain("cell=");
    expect(businessQuery.safeParse({ process: "invalid" }).success).toBe(false);
  });
});
describe("Business read service on isolated in-memory PostgreSQL", () => {
  const pg = new PGlite();
  const db = drizzle(pg, { schema: s });
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "src/db/migrations" });
    const f = fixture();
    await db
      .insert(s.businessNodes)
      .values(f.processes.filter((p) => p.parentId === null));
    await db
      .insert(s.businessNodes)
      .values(f.processes.filter((p) => p.parentId !== null));
    await db.insert(s.taskClasses).values(f.tasks);
    await db
      .insert(s.scenarios)
      .values(
        f.scenarios.map((row, i) => ({
          ...row,
          implementation: row.implementation as "yes" | "no",
          externalId: `TEST-${i}`,
          originNamespace: "business-test",
        })),
      );
    await db.insert(s.technologyDirections).values(f.directions);
    await db
      .insert(s.keyTechnologies)
      .values({ id: id("key"), name: "Технология", directionId: id("tech") });
    await db
      .insert(s.technologyMethods)
      .values(
        [1, 2].map((n) => ({
          id: id(`method${n}`),
          name: `Метод ${n}`,
          technologyId: id("key"),
        })),
      );
    await db
      .insert(s.scenarioTechnologies)
      .values(
        [1, 2].map((n) => ({
          scenarioId: id("yes"),
          methodId: id(`method${n}`),
        })),
      );
    await db.insert(s.scenarioTasks).values([
      { taskId: id("one"), scenarioId: id("yes") },
      { taskId: id("two"), scenarioId: id("no") },
    ]);
    await db.insert(s.effectTypes).values({ id: id("effect"), name: "Эффект" });
    await db
      .insert(s.scenarioEffects)
      .values(
        f.effects.map((e) => ({ effectId: e.id, scenarioId: e.scenarioId })),
      );
    await db.insert(s.benchmarkCases).values({ id: id("case"), name: "Кейс" });
    await db
      .insert(s.scenarioCases)
      .values(f.cases.map((c) => ({ caseId: c.id, scenarioId: c.scenarioId })));
    await db.insert(s.assessments).values([
      {
        scenarioId: id("yes"),
        metric: "market_maturity",
        value: 4,
        isCurrent: true,
        organizationalContext: "synthetic-lab",
        assessedAt: new Date(),
      },
      {
        scenarioId: id("yes"),
        metric: "market_maturity",
        value: 2,
        isCurrent: true,
        organizationalContext: "other",
        assessedAt: new Date(),
      },
    ]);
  }, 60000);
  afterAll(() => pg.close());
  it("loads actual joins without duplication and uses only the chosen assessment context", async () => {
    const x = await getBusinessData("synthetic-lab", db as unknown as Database);
    expect(x.summary(id("root"), id("tech")).scenarios).toHaveLength(1);
    expect(x.forTask(id("one"))).toHaveLength(1);
    expect(x.effectsFor(x.summary().scenarios)).toHaveLength(1);
    expect(x.casesFor(x.summary().scenarios)).toHaveLength(1);
    expect(x.facts.scores).toMatchObject([
      { scenarioId: id("yes"), metric: "market_maturity", value: 4 },
    ]);
    expect(
      (await getBusinessData("other", db as unknown as Database)).facts
        .scores[0].value,
    ).toBe(2);
  });
});
