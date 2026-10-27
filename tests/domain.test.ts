import { describe, expect, it } from "vitest";
import {
  assessmentInput,
  scenarioInput,
  scenarioQuery,
} from "../src/domain/scenario";
import { generateDataset } from "../scripts/synthetic";

describe("Предметные правила", () => {
  it.each([
    ["market_maturity", 6],
    ["organizational_readiness", 8],
    ["business_impact", 4],
    ["application_trl", 10],
    ["business_impact", 0],
    ["market_maturity", 2.5],
  ])("отклоняет %s=%s", (metric, value) => {
    expect(
      assessmentInput.safeParse({
        metric,
        value,
        sourceId: null,
        assessedAt: "2026-01-01T00:00:00Z",
        organizationalContext: "test",
      }).success,
    ).toBe(false);
  });
  it("принимает сценарий без кейса и оценок", () => {
    expect(
      scenarioInput.parse({
        externalId: "S-1",
        originNamespace: "test",
        name: "Синтетический сценарий",
        description: "Описание",
        isSynthetic: true,
      }).implementation,
    ).toBe("unknown");
  });
  it.each([
    { page: "0" },
    { pageSize: "1000" },
    { maturity: "6" },
    { directionId: "bad-id" },
    { readiness: "8" },
    { impact: "4" },
    { q: "x".repeat(201) },
    { context: "" },
  ])("отклоняет параметры %j", (query) =>
    expect(scenarioQuery.safeParse(query).success).toBe(false),
  );
  it("разбирает пустые фильтры и ограничивает размер страницы", () =>
    expect(
      scenarioQuery.parse({ maturity: "", directionId: "" }),
    ).toMatchObject({ page: 1, pageSize: 12, context: "synthetic-lab" }));
});
describe("Синтетический генератор", () => {
  it("воспроизводим и не зависит от размера для одних и тех же ID", () => {
    const a = generateDataset(80),
      b = generateDataset(80),
      large = generateDataset(2500);
    expect(a).toEqual(b);
    expect(large.scenarios.slice(0, 80)).toEqual(a.scenarios);
    expect(
      large.assessments.filter((r) =>
        a.scenarios.some((s) => s.id === r.scenarioId),
      ),
    ).toEqual(a.assessments);
    expect(new Set(large.scenarios.map((s) => s.id)).size).toBe(2500);
    expect(new Set(a.scenarios.map((s) => s.functionalGroupId)).size).toBe(4);
  });
  it("маркирует сущности, оценки и связи как синтетические", () => {
    for (const values of Object.values(generateDataset()))
      expect(values.every((r) => r.isSynthetic)).toBe(true);
  });
  it("обеспечивает ссылки всех трёх уровней технологий", () => {
    const data = generateDataset();
    for (const method of data.methods)
      expect(data.technologies.some((t) => t.id === method.technologyId)).toBe(
        true,
      );
    for (const technology of data.technologies)
      expect(data.directions.some((d) => d.id === technology.directionId)).toBe(
        true,
      );
    for (const link of data.scenarioTechnologies)
      expect(data.methods.some((m) => m.id === link.methodId)).toBe(true);
  });
});
