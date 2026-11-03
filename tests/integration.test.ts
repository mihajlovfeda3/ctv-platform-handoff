import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import { migrate as pgliteMigrate } from "drizzle-orm/pglite/migrator";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq, sql, count } from "drizzle-orm";
import { createDatabase, type Database } from "../src/db/client";
import * as s from "../src/db/schema";
import { scenarioAnalytics } from "../src/server/analytics";
import { seedDatabase } from "../src/server/seed";
import {
  createScenario,
  listScenarios,
  relatedObjects,
  getScenario,
  getReferences,
} from "../src/server/scenarios";
import { applyImport } from "../src/server/import";
import { prepareImport } from "../src/features/import/parse";
import { stableId } from "../src/lib/identity";
let db: Database, close: () => Promise<void>;
const config = { migrationsFolder: "src/db/migrations" };
const mapping = {
  columns: {
    externalId: "id",
    name: "title",
    description: "description",
    application_trl: "trl",
    organizational_readiness: "og",
  },
};
const options = {
  namespace: "integration-import",
  sourceName: "Синтетический интеграционный тест",
  synthetic: true,
  context: "synthetic-lab",
  assessedAt: "2026-01-01T00:00:00Z",
};
const prepare = (row: Record<string, unknown> = {}) =>
  prepareImport(
    JSON.stringify([
      {
        id: "001",
        title: "Тест импорта",
        description: "Синтетическая запись",
        trl: 45292,
        og: null,
        ...row,
      },
    ]),
    "json",
    mapping,
    options,
  );
describe(`Интеграция: ${process.env.TEST_DATABASE_URL ? "PostgreSQL" : "PGlite (PostgreSQL WASM)"}`, () => {
  beforeAll(async () => {
    if (process.env.TEST_DATABASE_URL) {
      if (!new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test"))
        throw new Error("Только отдельная база с суффиксом _test");
      const client = createDatabase(process.env.TEST_DATABASE_URL);
      db = client.db;
      close = () => client.pool.end();
      // Explicitly isolated test database; never the development database.
      await db.execute(sql`drop schema if exists public cascade`);
      await db.execute(sql`drop schema if exists drizzle cascade`);
      await db.execute(sql`create schema public`);
      await migrate(db, config);
      await migrate(db, config);
    } else {
      const pg = new PGlite();
      db = pgliteDrizzle(pg, { schema: s }) as unknown as Database;
      close = () => pg.close();
      await pgliteMigrate(
        db as unknown as ReturnType<typeof pgliteDrizzle>,
        config,
      );
      await pgliteMigrate(
        db as unknown as ReturnType<typeof pgliteDrizzle>,
        config,
      );
    }
    await seedDatabase(db, 80);
  }, 60000);
  afterAll(async () => {
    if (close) await close();
  });
  it("применяет миграции повторно и повторяет seed без дублей", async () => {
    await seedDatabase(db, 80);
    expect((await listScenarios({}, db)).total).toBe(80);
    expect(
      (await db.select({ total: count() }).from(s.scenarioTechnologies))[0]
        .total,
    ).toBe(80);
  });
  it("исправляет только старое название генератора и сохраняет идентификаторы", async () => {
    const migration = readFileSync(
      "src/db/migrations/0003_clean_generated_scenario_names.sql",
      "utf8",
    );
    await expect(
      db.transaction(async (tx) => {
        const [item] = await tx
          .select()
          .from(s.scenarios)
          .where(eq(s.scenarios.externalId, "SYN-0001"));
        expect(item.name).not.toMatch(/ · \d+$/);
        const legacyTitle = `${item.name} · 001`;
        await tx
          .update(s.scenarios)
          .set({ name: legacyTitle })
          .where(eq(s.scenarios.id, item.id));
        const [imported] = await tx
          .insert(s.scenarios)
          .values({
            externalId: "SYN-0001",
            originNamespace: "migration-test-import",
            name: legacyTitle,
            description: "Импортированная запись.",
            isSynthetic: false,
          })
          .returning();
        const customTitle = "Калибровка измерительной установки · 002";
        const custom = eq(s.scenarios.externalId, "SYN-0002");
        await tx.update(s.scenarios).set({ name: customTitle }).where(custom);
        await tx.execute(sql.raw(migration));
        await tx.execute(sql.raw(migration));
        expect(
          (
            await tx
              .select()
              .from(s.scenarios)
              .where(eq(s.scenarios.id, item.id))
          )[0],
        ).toMatchObject({
          id: item.id,
          externalId: item.externalId,
          name: item.name,
        });
        expect(
          (
            await tx
              .select()
              .from(s.scenarios)
              .where(eq(s.scenarios.id, imported.id))
          )[0].name,
        ).toBe(legacyTitle);
        expect(
          (await tx.select().from(s.scenarios).where(custom))[0].name,
        ).toBe(customTitle);
        expect(
          (await tx.select({ total: count() }).from(s.scenarios))[0].total,
        ).toBe(81);
        tx.rollback();
      }),
    ).rejects.toThrow("Rollback");
  });
  it("разделяет классификаторы и совместно фильтрует блок, бизнес и технологию", async () => {
    const refs = await getReferences(db);
    expect(refs.directions).toHaveLength(8);
    expect(refs.businessDirections.map((x) => x.name)).toContain(
      "Управление имуществом",
    );
    expect(refs.blocks).toHaveLength(11);
    expect(refs.businessDirections).toHaveLength(31);
    const blockId = stableId("test-only-block");
    await db.insert(s.organizationalBlocks).values({
      id: blockId,
      name: "Тестовый блок (только автоматический тест)",
      isSynthetic: true,
    });
    const [link] = await db.select().from(s.scenarioClassification).limit(1);
    await db
      .update(s.scenarioClassification)
      .set({ blockId })
      .where(eq(s.scenarioClassification.scenarioId, link.scenarioId));
    const tech = (await relatedObjects(link.scenarioId, db)).technologies[0]
      .direction;
    const directionId = refs.directions.find((d) => d.name === tech)!.id;
    const result = await listScenarios(
      { blockId, businessDirectionId: link.businessDirectionId, directionId },
      db,
    );
    expect(result.items.map((x) => x.id)).toEqual([link.scenarioId]);
    expect(
      (
        await listScenarios(
          {
            blockId,
            businessDirectionId: refs.businessDirections.find(
              (d) => d.id !== link.businessDirectionId,
            )!.id,
          },
          db,
        )
      ).total,
    ).toBe(0);
    await db
      .update(s.scenarioClassification)
      .set({ blockId: null })
      .where(eq(s.scenarioClassification.scenarioId, link.scenarioId));
    await db
      .delete(s.organizationalBlocks)
      .where(eq(s.organizationalBlocks.id, blockId));
  });
  it("каждый элемент полного справочника участвует в фильтрации", async () => {
    const refs = await getReferences(db);
    expect(refs.directions.map((d) => d.name)).toContain(
      "Беспилотные воздушные средства",
    );
    expect(refs.directions.map((d) => d.name)).not.toContain("БВС");
    for (const business of refs.businessDirections)
      expect(
        (await listScenarios({ businessDirectionId: business.id }, db)).total,
      ).toBeGreaterThan(0);
    for (const block of refs.blocks)
      expect(
        (await listScenarios({ blockId: block.id }, db)).total,
      ).toBeGreaterThan(0);
    for (const direction of refs.directions)
      expect(
        (await listScenarios({ directionId: direction.id }, db)).total,
      ).toBeGreaterThan(0);
  });
  it("повторный seed сохраняет несинтетические записи и их связи", async () => {
    const id = stableId("real-preservation-test");
    await createScenario(
      {
        id,
        name: "Проверка защиты",
        description: "Только автоматический тест",
        externalId: "SAFE",
        originNamespace: "test-real",
        isSynthetic: false,
      },
      db,
    );
    await db
      .insert(s.scenarioClassification)
      .values({ scenarioId: id, isSynthetic: false });
    await seedDatabase(db, 80);
    expect((await getScenario(id, db))?.scenario.isSynthetic).toBe(false);
    expect(
      (
        await db
          .select()
          .from(s.scenarioClassification)
          .where(eq(s.scenarioClassification.scenarioId, id))
      )[0].isSynthetic,
    ).toBe(false);
    await db.delete(s.scenarios).where(eq(s.scenarios.id, id));
  });
  it("аналитика дедуплицирует методы и сохраняет разные технологические направления", async () => {
    const refs = await getReferences(db);
    const original = (
      await scenarioAnalytics({ q: "SYN-0012", pageSize: 1 }, db)
    ).rows[0];
    const otherTechnology = refs.technologies.find(
      (t) => !original.directions.some((d) => d.id === t.directionId),
    )!;
    const method = refs.methods.find(
      (m) => m.technologyId === otherTechnology.id,
    )!;
    await db
      .insert(s.scenarioTechnologies)
      .values({
        scenarioId: original.id,
        methodId: method.id,
        isSynthetic: true,
      });
    try {
      const data = await scenarioAnalytics({ q: "SYN-0012" }, db);
      expect(data.total).toBe(1);
      expect(data.rows[0].directions).toHaveLength(2);
      expect(
        (
          await scenarioAnalytics(
            { q: "SYN-0012", directionId: otherTechnology.directionId },
            db,
          )
        ).rows[0].directions,
      ).toHaveLength(1);
    } finally {
      await db
        .delete(s.scenarioTechnologies)
        .where(sql`scenario_id=${original.id} and method_id=${method.id}`);
    }
  });
  it("создаёт сценарий и читает соответствующий ID", async () => {
    const scenario = await createScenario(
      {
        externalId: "CREATE-001",
        originNamespace: "test-create",
        name: "Запись создания",
        description: "Синтетическая запись",
        isSynthetic: true,
      },
      db,
    );
    expect((await getScenario(scenario.id, db))?.scenario.name).toBe(
      "Запись создания",
    );
    expect(await getScenario(stableId("missing"), db)).toBeNull();
    await expect(
      createScenario(
        {
          externalId: "CREATE-001",
          originNamespace: "test-create",
          name: "Повтор",
          description: "Тест",
          isSynthetic: true,
        },
        db,
      ),
    ).rejects.toThrow();
  });
  it("возвращает ограниченную страницу и выполняет поиск на сервере", async () => {
    const first = await listScenarios({ q: "SYN-", pageSize: 7 }, db),
      second = await listScenarios({ q: "SYN-", pageSize: 7, page: 2 }, db);
    expect(first.total).toBe(80);
    expect(first.items).toHaveLength(7);
    expect(
      first.items.some((a) => second.items.some((b) => b.id === a.id)),
    ).toBe(false);
    expect((await listScenarios({ q: "ПрОгНоЗиРоВаНиЕ" }, db)).total).toBe(16);
    expect((await listScenarios({ q: "%" }, db)).total).toBe(0);
  });
  it("фильтрует технологии, процесс и независимые оценки в одном контексте", async () => {
    const refs = await getReferences(db),
      directionId = refs.directions[0].id;
    const byTech = await listScenarios({ directionId, pageSize: 100 }, db);
    expect(byTech.total).toBeGreaterThan(0);
    for (const row of byTech.items)
      expect(
        (await relatedObjects(row.id, db)).technologies.some(
          (t) => t.direction === refs.directions[0].name,
        ),
      ).toBe(true);
    const sample = (
      await listScenarios({ q: "SYN-", pageSize: 100 }, db)
    ).items.find(
      (row) =>
        row.assessments.some((a) => a.metric === "market_maturity") &&
        row.assessments.some((a) => a.metric === "organizational_readiness"),
    )!;
    const maturity = sample.assessments.find(
        (a) => a.metric === "market_maturity",
      )!.value!,
      readiness = sample.assessments.find(
        (a) => a.metric === "organizational_readiness",
      )!.value!;
    const rows = await listScenarios(
      { maturity, readiness, pageSize: 100 },
      db,
    );
    expect(rows.total).toBeGreaterThan(0);
    for (const row of rows.items) {
      expect(
        row.assessments.some(
          (a) => a.metric === "market_maturity" && a.value === maturity,
        ),
      ).toBe(true);
      expect(
        row.assessments.some(
          (a) =>
            a.metric === "organizational_readiness" && a.value === readiness,
        ),
      ).toBe(true);
    }
    expect(
      (await listScenarios({ maturity: 3, context: "another-context" }, db))
        .total,
    ).toBe(0);
    const business = await listScenarios(
      {
        businessNodeId: refs.business.find((n) => n.kind === "process")!.id,
        implementation: "no",
      },
      db,
    );
    expect(business.total).toBeGreaterThan(0);
    expect(business.items.every((r) => r.implementation === "no")).toBe(true);
  });
  it("хранит все связанные слои и допускает сценарий без кейса", async () => {
    const all = await listScenarios({ q: "SYN-0001" }, db),
      related = await relatedObjects(all.items[0].id, db);
    for (const key of [
      "technologies",
      "tasks",
      "effects",
      "cases",
      "solutions",
      "projects",
    ] as const)
      expect(related[key].length).toBeGreaterThan(0);
    const withoutCase = await listScenarios({ q: "SYN-0002" }, db);
    expect((await relatedObjects(withoutCase.items[0].id, db)).cases).toEqual(
      [],
    );
  });
  it("ограничивает ссылки и оценки непосредственно в БД", async () => {
    await expect(
      db.insert(s.scenarioTechnologies).values({
        scenarioId: stableId("missing-scenario"),
        methodId: stableId("missing-method"),
      }),
    ).rejects.toThrow();
    const [scenario] = await db.select().from(s.scenarios).limit(1);
    await expect(
      db.insert(s.assessments).values({
        scenarioId: scenario.id,
        metric: "business_impact",
        value: 7,
        organizationalContext: "test-bad",
        assessedAt: new Date(),
        isSynthetic: true,
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(s.assessments).values({
        scenarioId: scenario.id,
        metric: "market_maturity",
        value: null,
        organizationalContext: "test-null",
        assessedAt: new Date(),
        isSynthetic: true,
      }),
    ).rejects.toThrow();
  });
  it("импортирует без вымышленных оценок, хранит raw и пропускает повтор", async () => {
    expect((await applyImport(db, prepare())).created).toBe(1);
    expect(
      (await applyImport(db, prepare({ title: "Не должен перезаписать" })))
        .skipped,
    ).toBe(1);
    const result = await listScenarios({ q: "Тест импорта" }, db);
    expect(result.total).toBe(1);
    expect(result.items[0].assessments).toEqual([]);
    const [raw] = await db
      .select()
      .from(s.importRows)
      .where(eq(s.importRows.scenarioId, result.items[0].id));
    expect(JSON.parse(raw.raw).trl).toBe(45292);
  });
  it("откатывает весь импорт при несуществующей ссылке", async () => {
    const prepared = prepareImport(
      JSON.stringify([
        {
          id: "ROLLBACK-GOOD",
          title: "Откат",
          description: "Синтетика",
          process: null,
        },
        {
          id: "ROLLBACK-BAD",
          title: "Откат",
          description: "Синтетика",
          process: stableId("missing-process"),
        },
      ]),
      "json",
      {
        columns: {
          externalId: "id",
          name: "title",
          description: "description",
          businessNodeId: "process",
        },
      },
      options,
    );
    await expect(applyImport(db, prepared)).rejects.toThrow();
    expect((await listScenarios({ q: "ROLLBACK-" }, db)).total).toBe(0);
  });
  it("отклоняет ошибочный пакет до записи", async () => {
    const invalid = prepare({ title: "" });
    await expect(applyImport(db, invalid)).rejects.toThrow();
  });
  it("не смешивает текущие оценки разных организаций и запрещает дубли в одном контексте", async () => {
    const item = (await listScenarios({ q: "SYN-0001" }, db)).items[0];
    const input = {
      scenarioId: item.id,
      metric: "market_maturity" as const,
      value: 4,
      organizationalContext: "other-lab",
      assessedAt: new Date("2026-01-01T00:00:00Z"),
      isSynthetic: true,
    };
    await db.insert(s.assessments).values(input);
    await expect(db.insert(s.assessments).values(input)).rejects.toThrow();
    expect(
      (await listScenarios({ q: "SYN-0001", maturity: 4 }, db)).total,
    ).toBe(0);
    expect(
      (
        await listScenarios(
          { q: "SYN-0001", maturity: 4, context: "other-lab" },
          db,
        )
      ).total,
    ).toBe(1);
  });
  it("отклоняет цикл бизнес-иерархии", async () => {
    const [parent] = await db
      .select()
      .from(s.businessNodes)
      .where(eq(s.businessNodes.kind, "direction"))
      .limit(1);
    const [child] = await db
      .select()
      .from(s.businessNodes)
      .where(eq(s.businessNodes.parentId, parent.id));
    await expect(
      db
        .update(s.businessNodes)
        .set({ parentId: child.id })
        .where(eq(s.businessNodes.id, parent.id)),
    ).rejects.toThrow();
  });
  it("фильтрует диапазон оценок и сортирует без загрузки всего набора в браузер", async () => {
    const rows = await listScenarios(
      { maturityMin: 2, maturityMax: 4, pageSize: 100 },
      db,
    );
    expect(rows.total).toBeGreaterThan(0);
    expect(
      rows.items.every((row) =>
        row.assessments.some(
          (a) =>
            a.metric === "market_maturity" && a.value! >= 2 && a.value! <= 4,
        ),
      ),
    ).toBe(true);
    const sorted = await listScenarios(
      { q: "SYN-", sort: "id", order: "desc", pageSize: 3 },
      db,
    );
    expect(sorted.items.map((row) => row.externalId)).toEqual([
      "SYN-0080",
      "SYN-0079",
      "SYN-0078",
    ]);
  });
  it("расширяет синтетический набор до 2500 записей с серверной пагинацией", async () => {
    await seedDatabase(db, 2500);
    const result = await listScenarios(
      { q: "SYN-", page: 200, pageSize: 12 },
      db,
    );
    expect(result.total).toBe(2500);
    expect(result.items).toHaveLength(12);
    expect(result.pages).toBe(209);
    const start = performance.now();
    const analytics = await scenarioAnalytics(
      { q: "SYN-", page: 200, pageSize: 1 },
      db,
    );
    expect(analytics.total).toBe(2500);
    expect(analytics.rows).toHaveLength(2500);
    expect(new Set(analytics.rows.map((r) => r.id)).size).toBe(2500);
    expect(analytics.rows.some((r) => r.maturity === null)).toBe(true);
    const filtered = await scenarioAnalytics(
      { q: "SYN-", maturityMin: 2, maturityMax: 3, readinessMin: 4 },
      db,
    );
    expect(
      filtered.rows.every(
        (r) => r.maturity! >= 2 && r.maturity! <= 3 && r.readiness! >= 4,
      ),
    ).toBe(true);
    const other = await scenarioAnalytics(
      { q: "SYN-", context: "unassessed" },
      db,
    );
    expect(
      other.rows.every((r) => r.maturity === null && r.readiness === null),
    ).toBe(true);
    console.log(
      `Analytics 2500: ${Math.round(performance.now() - start)}ms / three queries (${process.env.TEST_DATABASE_URL ? "PostgreSQL" : "PGlite"})`,
    );
  });
});
