import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import type { Analytics } from "../../src/domain/analytics";
import { matrixPosition } from "../../src/domain/camera";
import { matrixCells } from "../../src/domain/analytics";

async function data(request: APIRequestContext): Promise<Analytics> {
  const result = await (
    await request.get("/api/scenarios/analytics?q=SYN-")
  ).json();
  expect(result.total).toBe(Number(process.env.PERF_SIZE ?? 80));
  return result;
}
async function ready(page: Page) {
  await expect(page.locator(".shared-filters")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.getByTestId("matrix-workspace")).toBeVisible();
  await page
    .locator(".matrix-mode-layer")
    .evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))),
    );
  if (await page.locator(".matrix-scatter").count())
    await expect
      .poll(() =>
        page
          .locator(".matrix-scatter")
          .evaluate((el) =>
            Math.abs(
              (el as SVGSVGElement).viewBox.baseVal.width -
                el.getBoundingClientRect().width,
            ),
          ),
      )
      .toBeLessThan(0.2);
}
async function cellsMode(page: Page) {
  await page
    .locator(".matrix-switch")
    .getByRole("link", { name: "Ячейки", exact: true })
    .click();
  await expect(page.locator(".maturity-matrix")).toBeVisible();
  await ready(page);
}

test("one compact workspace, default points, stable modes and counts from the full PostgreSQL selection", async ({
  page,
  request,
}) => {
  const analytics = await data(request),
    cells = matrixCells(analytics.rows);
  await page.goto("/scenarios/maturity?q=SYN-");
  await ready(page);
  await expect(page.locator("h1")).toHaveText("Матрица зрелости");
  await expect(
    page.locator(".analytical-heading h2, .aggregate-matrix, .cell-count"),
  ).toHaveCount(0);
  await expect(page.locator(".matrix-switch a")).toHaveText([
    "Точки",
    "Ячейки",
  ]);
  await expect(page.locator('.matrix-switch [aria-current="true"]')).toHaveText(
    "Точки",
  );
  await expect(
    page.locator(
      ".shared-filter-row > label, .shared-filter-row > .filter-field",
    ),
  ).toHaveCount(3);
  await expect(page.locator('[name="maturityMin"]')).toBeHidden();
  await expect(page.locator(".matrix-point")).toHaveCount(
    analytics.total - (cells.get("unknown")?.length ?? 0),
  );
  const box = (await page.getByTestId("matrix-workspace").boundingBox())!;
  await cellsMode(page);
  expect(
    (await page.getByTestId("matrix-workspace").boundingBox())!.height,
  ).toBeCloseTo(box.height, 1);
  await expect(page.locator("button[data-cell]")).toHaveCount(35);
  const shown = await page.locator("button[data-cell]").evaluateAll((nodes) =>
    nodes.map((n) => ({
      key: n.getAttribute("data-cell")!,
      count: Number(n.textContent),
    })),
  );
  for (const cell of shown)
    expect(cell.count).toBe(cells.get(cell.key)?.length ?? 0);
  expect(
    shown.reduce((n, c) => n + c.count, 0) +
      (cells.get("unknown")?.length ?? 0),
  ).toBe(analytics.total);
  await expect(page.locator(".matrix-total")).toHaveAttribute(
    "data-total",
    String(analytics.total),
  );
  await expect(page.getByRole("button", { name: /Без РЗ или ОГ:/ })).toHaveText(
    `Без РЗ или ОГ: ${cells.get("unknown")?.length ?? 0}`,
  );
  expect(
    (await page.locator("button[data-cell]").first().boundingBox())!.height,
  ).toBeGreaterThan(50);
  await page.reload();
  await ready(page);
  await expect(page.locator('.matrix-switch [aria-current="true"]')).toHaveText(
    "Ячейки",
  );
  expect(new URL(page.url()).searchParams.get("q")).toBe("SYN-");
});

test("stable discrete positions, unchanged quadrants and annotations clear of scenario marks", async ({
  page,
  request,
}) => {
  const analytics = await data(request);
  await page.goto("/scenarios/maturity?q=SYN-");
  await ready(page);
  await expect(page.getByTestId("zone-boundaries")).toHaveAttribute(
    "data-readiness",
    "3.5",
  );
  await expect(page.getByTestId("zone-boundaries")).toHaveAttribute(
    "data-maturity",
    "3.5",
  );
  await expect(page.locator(".matrix-zone-title")).toHaveText([
    "Венчур",
    "Мейнстрим",
    "Космос",
    "Уникальные компетенции",
  ]);
  const positions = await page.locator(".matrix-scatter").evaluate((svg) => {
    const left = Number(svg.getAttribute("data-plot-left")),
      bottom = Number(svg.getAttribute("data-plot-bottom")),
      xs = Number(svg.getAttribute("data-x-step")),
      ys = Number(svg.getAttribute("data-y-step"));
    return [...svg.querySelectorAll(".matrix-point")].map((p) => ({
      id: p.getAttribute("data-scenario")!,
      x: (Number(p.getAttribute("cx")) - left) / xs + 0.5,
      y: (bottom - Number(p.getAttribute("cy"))) / ys + 0.5,
      m: Number(p.getAttribute("data-maturity")),
      r: Number(p.getAttribute("data-readiness")),
      radius: Number(p.getAttribute("r")),
    }));
  });
  for (const p of positions) {
    expect(Math.round(p.x)).toBe(p.r);
    expect(Math.round(p.y)).toBe(p.m);
    expect({ x: p.x, y: p.y }).toEqual(
      expect.objectContaining({
        x: expect.closeTo(matrixPosition(p.id, p.m, p.r).x, 6),
        y: expect.closeTo(matrixPosition(p.id, p.m, p.r).y, 6),
      }),
    );
  }
  expect(positions.length).toBe(
    analytics.rows.filter((r) => r.maturity !== null && r.readiness !== null)
      .length,
  );
  const overlaps = await page.locator(".matrix-scatter").evaluate((svg) => {
    const labels = [...svg.querySelectorAll(".matrix-zone text")].map((n) =>
      n.getBoundingClientRect(),
    );
    return [...svg.querySelectorAll(".matrix-point")].some((p) => {
      const b = p.getBoundingClientRect();
      return labels.some(
        (a) =>
          a.left < b.right &&
          a.right > b.left &&
          a.top < b.bottom &&
          a.bottom > b.top,
      );
    });
  });
  expect(overlaps).toBe(false);
  if (analytics.total > 1000)
    expect(Math.max(...positions.map((p) => p.radius))).toBeLessThan(6.5);
  const width = (await page.getByTestId("matrix-workspace").boundingBox())!
    .width;
  await page
    .getByRole("button", { name: "Свернуть панель", exact: true })
    .click();
  await page.mouse.move(page.viewportSize()!.width - 30, 60);
  await expect
    .poll(
      async () =>
        (await page.getByTestId("matrix-workspace").boundingBox())!.width,
    )
    .toBeGreaterThan(width);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await cellsMode(page);
  await expect(page.locator("button[data-cell]")).toHaveCount(35);
  await page
    .getByRole("button", { name: "Развернуть панель", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await page.getByTestId("matrix-workspace").boundingBox())!.width,
    )
    .toBeCloseTo(width, 1);
});

test("point/cell tooltips, inspector, full card return, unknown selection and Escape preserve context", async ({
  page,
  request,
}) => {
  const analytics = await data(request),
    cells = matrixCells(analytics.rows);
  await page.goto("/scenarios/maturity?q=SYN-");
  await ready(page);
  const point = page.locator(".matrix-point").first(),
    id = await point.getAttribute("data-scenario");
  await point.hover({ force: true });
  await expect(page.getByRole("tooltip")).toBeVisible();
  await point.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(page.getByRole("tooltip")).toContainText("влияние");
  await point.press("Enter");
  await expect(
    page.getByRole("region", { name: "Быстрый просмотр сценария" }),
  ).toBeVisible();
  await cellsMode(page);
  expect(new URL(page.url()).searchParams.get("selected")).toBe(id);
  const infoButton = page.getByRole("button", { name: "О матрице и выборке" });
  const popover = page.locator(".matrix-info-popover");
  await infoButton.click();
  await expect(popover).toBeVisible();
  // Escape may arrive before the native popover has moved focus from the trigger.
  await infoButton.focus();
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  expect(new URL(page.url()).searchParams.get("selected")).toBe(id);
  await page.getByRole("link", { name: "Открыть полную карточку →" }).click();
  await expect(page).toHaveURL(/from=maturity/);
  await page.getByRole("link", { name: "← Вернуться к выборке" }).click();
  await expect(page.locator(".maturity-matrix")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("matrixMode")).toBe("cells");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("region", { name: "Быстрый просмотр сценария" }),
  ).toHaveCount(0);
  const key = [...cells.entries()].find(
    ([k, rows]) => k !== "unknown" && rows.length,
  )![0];
  const cell = page.locator(`button[data-cell="${key}"]`);
  await cell.focus();
  await expect(page.getByRole("tooltip")).toContainText(
    "Требуют уточнения статуса:",
  );
  await cell.press("Enter");
  await expect(page.locator(".group-members a")).toHaveCount(
    cells.get(key)!.length,
  );
  await page.locator(".group-members a").first().click();
  await expect(
    page.getByRole("region", { name: "Быстрый просмотр сценария" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Состав выбранной группы")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Состав выбранной группы")).toHaveCount(0);
  await page.getByRole("button", { name: /Без РЗ или ОГ:/ }).click();
  await expect(page.locator(".group-members a")).toHaveCount(
    cells.get("unknown")?.length ?? 0,
  );
  expect(new URL(page.url()).searchParams.get("matrixMode")).toBe("cells");
  expect(new URL(page.url()).searchParams.get("q")).toBe("SYN-");
});

test("ranges, direction, status, empty state and view navigation share the same URL selection", async ({
  page,
  request,
}) => {
  await page.goto("/scenarios/maturity?q=SYN-");
  await ready(page);
  await cellsMode(page);
  await page.locator(".advanced-filters summary").click();
  await page.locator("[name=maturityMin]").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/maturityMin=2/);
  await page.getByRole("button", { name: "РЕАЛИЗАЦИЯ", exact: true }).click();
  await page.getByRole("option", { name: "Реализуется", exact: true }).click();
  await expect(page).toHaveURL(/implementation=yes/);
  await page
    .getByRole("button", { name: "ТЕХНОЛОГИЧЕСКОЕ НАПРАВЛЕНИЕ", exact: true })
    .click();
  await page.getByRole("option").nth(1).click();
  await expect(page).toHaveURL(/directionId=/);
  const current = new URL(page.url()),
    params = current.searchParams.toString();
  const filtered: Analytics = await (
    await request.get(`/api/scenarios/analytics?${params}`)
  ).json();
  await expect(page.locator(".matrix-total")).toHaveAttribute(
    "data-total",
    String(filtered.total),
  );
  expect(current.searchParams.get("matrixMode")).toBe("cells");
  await page
    .getByRole("navigation", { name: "Представления сценариев" })
    .getByRole("link", { name: "Технологический радар", exact: true })
    .click();
  await expect(page.locator(".interactive-radar")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("directionId")).toBe(
    current.searchParams.get("directionId"),
  );
  await page
    .getByRole("navigation", { name: "Представления сценариев" })
    .getByRole("link", { name: "Матрица зрелости", exact: true })
    .click();
  await expect(page.locator(".maturity-matrix")).toBeVisible();
  await page.goto("/scenarios/maturity?q=NO_MATCH_SYNTHETIC_MATRIX");
  await ready(page);
  await expect(page.locator(".matrix-point")).toHaveCount(0);
  await expect(page.locator(".analytics-empty")).toBeVisible();
  await cellsMode(page);
  await expect(page.locator("button[data-empty]")).toHaveCount(35);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".matrix-mode-layer")).toHaveCSS(
    "animation-name",
    "none",
  );
});
