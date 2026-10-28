import { describe, it, expect } from "vitest";
import { scenarioQuery } from "../src/domain/scenario";
import { workspaceHref, cardHref } from "../src/features/scenarios/navigation";
describe("Общий контекст сценариев", () => {
  const selected = "00000000-0000-4000-8000-000000000001";
  it("переносит фильтры, выбор, страницу, режим и контекст между тремя экранами", () => {
    const q = scenarioQuery.parse({
      q: "Учебный",
      maturityMin: 2,
      maturityMax: 4,
      context: "organization-A",
      selected,
      mode: "points",
      page: 3,
      sort: "impact",
      order: "desc",
    });
    for (const view of ["catalog", "radar", "maturity"] as const) {
      const url = new URL(workspaceHref(view, q), "http://local");
      expect(url.pathname).toBe(`/scenarios/${view}`);
      expect(scenarioQuery.parse(Object.fromEntries(url.searchParams))).toEqual(
        q,
      );
    }
  });
  it("сохраняет обратный путь из полной карточки и не разрешает внешний redirect", () => {
    const q = scenarioQuery.parse({ q: "test", selected });
    const url = new URL(cardHref(selected, "maturity", q), "http://local");
    expect(url.pathname).toBe(`/scenarios/${selected}`);
    const back = scenarioQuery.parse(Object.fromEntries(url.searchParams));
    expect(back.from).toBe("maturity");
    expect(workspaceHref(back.from, back)).toContain("selected=");
    expect(
      scenarioQuery.safeParse({ from: "https://outside.example" }).success,
    ).toBe(false);
  });
  it("закрывает инспектор без потери фильтров", () => {
    expect(
      workspaceHref("radar", scenarioQuery.parse({ selected, q: "abc" }), {
        selected: undefined,
      }),
    ).not.toContain("selected=");
  });
  it.each([
    { maturityMin: 4, maturityMax: 2 },
    { readinessMin: 8 },
    { impactMax: 4 },
  ])("отклоняет ошибочный диапазон %j", (q) =>
    expect(scenarioQuery.safeParse(q).success).toBe(false),
  );
  it("поддерживает старые точечные параметры API", () =>
    expect(
      scenarioQuery.parse({ maturity: "3", readiness: "5", impact: "2" }),
    ).toMatchObject({ maturity: 3, readiness: 5, impact: 2 }));
});
