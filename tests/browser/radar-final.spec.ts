import { test, expect, type Page } from "@playwright/test";
import { pointPosition, type Analytics } from "../../src/domain/analytics";

async function ready(page: Page) {
  await expect(page.locator(".shared-filters")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expectRestingLabels(page);
  await page
    .locator(".analytical-stage")
    .evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))),
    );
}
async function expectRestingLabels(page: Page) {
  const labels = page.locator(".direction-label");
  if (page.viewportSize()!.width <= 768)
    await expect.poll(() => labels.count()).toBeGreaterThanOrEqual(4);
  else await expect(labels).toHaveCount(8);
}
async function zoom(page: Page, target: number) {
  await page.locator(".interactive-radar").evaluate((el, target) => {
    const current = Number(
      el.querySelector("[data-testid=camera]")!.getAttribute("data-zoom"),
    );
    const b = el.getBoundingClientRect();
    el.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: Math.log(current / target) / 0.002,
        clientX: b.left + b.width / 2,
        clientY: b.top + b.height / 2,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, target);
  await expect
    .poll(async () =>
      Number(await page.getByTestId("camera").getAttribute("data-zoom")),
    )
    .toBeCloseTo(target, 5);
}

test("default, original point coordinates, capped markers and cursor-anchored local zoom", async ({
  page,
  request,
}) => {
  const data: Analytics = await (
    await request.get("/api/scenarios/analytics?q=SYN-")
  ).json();
  expect(data.total).toBe(Number(process.env.PERF_SIZE ?? 80));
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat/i.test(message.text()))
      hydrationErrors.push(message.text());
  });
  await page.goto("/scenarios/radar?q=SYN-");
  await ready(page);
  await expect(page.locator(".density-switch a")).toHaveText([
    "Точки",
    "Группы",
  ]);
  await expect(
    page.locator('.density-switch [aria-current="true"]'),
  ).toHaveText("Точки");
  await page.reload();
  await ready(page);
  await expect(
    page.locator('.density-switch [aria-current="true"]'),
  ).toHaveText("Точки");
  const firstPoint = page.locator("circle[data-scenario]").first();
  await firstPoint.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(page.getByRole("tooltip")).toContainText("РЗ");
  await page.locator(".interactive-radar").focus();
  const coordinates = await page
    .locator("circle[data-scenario]")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        id: n.getAttribute("data-scenario"),
        x: Number(n.getAttribute("cx")),
        y: Number(n.getAttribute("cy")),
      })),
    );
  const expected = data.rows.flatMap((row) =>
    row.maturity === null
      ? []
      : [...new Map(row.directions.map((d) => [d.id, d])).values()].map(
          (direction) => ({
            id: row.id,
            ...pointPosition(
              row.id,
              data.directions.findIndex((d) => d.id === direction.id),
              data.directions.length,
              row.maturity!,
            ),
          }),
        ),
  );
  const sort = (
    a: { id: string | null; x: number },
    b: { id: string | null; x: number },
  ) => String(a.id).localeCompare(String(b.id)) || a.x - b.x;
  coordinates.sort(sort);
  expected.sort(sort);
  expect(coordinates).toHaveLength(expected.length);
  coordinates.forEach(({ id, x, y }, i) => {
    expect(id).toBe(expected[i].id);
    expect(Math.abs(x - expected[i].x)).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(y - expected[i].y)).toBeLessThanOrEqual(1e-6);
  });
  expect(hydrationErrors).toEqual([]);
  const calls: string[] = [],
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      r.url().includes("/api/scenarios") ||
      (r.url().includes("/scenarios/radar") && r.url().includes("_rsc="))
    )
      calls.push(r.url());
  });
  for (const z of [3, 8, 3, 8]) {
    await zoom(page, z);
    expect(await page.locator(".direction-label").count()).toBeLessThanOrEqual(
      3,
    );
    const widths = await page
      .locator("circle[data-scenario]")
      .evaluateAll((nodes) =>
        nodes.map((n) => n.getBoundingClientRect().width),
      );
    expect(Math.max(...widths)).toBeLessThan(23);
  }
  await page.getByRole("button", { name: "Сброс масштаба" }).click();
  await expectRestingLabels(page);
  const anchor = await page.locator(".interactive-radar").evaluate((el) => {
    const b = el.getBoundingClientRect(),
      x = b.width * 0.61,
      y = b.height * 0.42;
    const event = new WheelEvent("wheel", {
      deltaY: -Math.log(3) / 0.002,
      clientX: b.left + x,
      clientY: b.top + y,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(event);
    return {
      x: event.clientX - b.left - b.width / 2,
      y: event.clientY - b.top - b.height / 2,
    };
  });
  await expect
    .poll(async () =>
      Number(await page.getByTestId("camera").getAttribute("data-zoom")),
    )
    .toBeCloseTo(3, 5);
  const x = Number(await page.getByTestId("camera").getAttribute("data-pan-x")),
    y = Number(await page.getByTestId("camera").getAttribute("data-pan-y"));
  expect((anchor.x - x) / 3).toBeCloseTo(anchor.x, 3);
  expect((anchor.y - y) / 3).toBeCloseTo(anchor.y, 3);
  expect(calls).toEqual([]);
  expect(errors).toEqual([]);
});

test("density hierarchy conserves membership, separates counts and refines on zoom", async ({
  page,
  request,
}) => {
  const data: Analytics = await (
    await request.get("/api/scenarios/analytics?q=SYN-")
  ).json();
  expect(data.total).toBe(Number(process.env.PERF_SIZE ?? 80));
  const expected = data.rows.reduce(
    (n, r) =>
      n +
      (r.maturity === null ? 0 : new Set(r.directions.map((d) => d.id)).size),
    0,
  );
  await page.goto("/scenarios/radar?q=SYN-&mode=groups");
  await ready(page);
  await page.reload();
  await ready(page);
  await expect(
    page.locator('.density-switch [aria-current="true"]'),
  ).toHaveText("Группы");
  const counts: number[] = [];
  for (const z of [1, 3, 8]) {
    if (z !== 1) await zoom(page, z);
    const groups = await page.locator(".radar-group").evaluateAll((nodes) =>
      nodes.map((node) => {
        const r = node
          .querySelector(".radar-group-surface")!
          .getBoundingClientRect();
        return {
          count: Number(node.getAttribute("data-count")),
          x: r.x + r.width / 2,
          y: r.y + r.height / 2,
          r: r.width / 2,
        };
      }),
    );
    const singles = await page.locator("circle[data-scenario]").count();
    expect(groups.reduce((n, g) => n + g.count, singles)).toBe(expected);
    counts.push(groups.length + singles);
    let minGap = Infinity;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      expect(g.r).toBeLessThanOrEqual(18.01);
      for (let j = i + 1; j < groups.length; j++) {
        const h = groups[j];
        minGap = Math.min(minGap, Math.hypot(g.x - h.x, g.y - h.y) - g.r - h.r);
      }
    }
    expect(minGap).toBeGreaterThanOrEqual(2.8);
  }
  expect(counts[1]).toBeGreaterThan(counts[0]);
  expect(counts[2]).toBeGreaterThanOrEqual(counts[1]);
  if (data.total > 1000) expect(counts[0]).toBeLessThan(data.total / 5);
  await page.getByRole("button", { name: "Сброс масштаба" }).click();
  const group = page.locator(".radar-group").first();
  await group.press("Enter");
  await expect(page.getByLabel("Состав выбранной группы")).toBeVisible();
  const key = new URL(page.url()).searchParams.get("cluster"),
    members = await page.locator(".group-members a").allTextContents();
  await page.getByRole("button", { name: "Приблизить группу" }).click();
  await expect(page.getByTestId("camera")).toHaveAttribute("data-zoom", "2");
  expect(new URL(page.url()).searchParams.get("cluster")).toBe(key);
  expect(await page.locator(".group-members a").allTextContents()).toEqual(
    members,
  );
  expect(new URL(page.url()).searchParams.get("q")).toBe("SYN-");
  await page.locator(".group-members a").first().click();
  await expect(
    page.getByRole("region", { name: "Быстрый просмотр сценария" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Состав выбранной группы")).toBeVisible();
});

test("selection follows the scenario across views without displacing radar labels", async ({
  page,
  request,
}, info) => {
  const data: Analytics = await (
    await request.get("/api/scenarios/analytics?q=SYN-")
  ).json();
  const row = data.rows.find((item) => item.externalId === "SYN-0004")!;
  const other = data.rows.find((item) => item.externalId === "SYN-0003")!;
  const tabs = page.getByRole("navigation", {
    name: "Представления сценариев",
  });
  const panel = page.getByRole("region", { name: "Быстрый просмотр сценария" });
  const labelLengths = () =>
    page.locator(".direction-leaders line").evaluateAll((lines) =>
      lines.map((line) => {
        const { x1, y1, x2, y2 } = line as SVGLineElement;
        return Math.hypot(
          x2.baseVal.value - x1.baseVal.value,
          y2.baseVal.value - y1.baseVal.value,
        );
      }),
    );
  const capture = async (name: string) => {
    if (
      process.env.SAVE_SELECTION_SCREENSHOTS &&
      info.project.name === "1920"
    ) {
      await page.locator(".analytical-stage").screenshot({
        path: `output/radar-selection/${name}.png`,
        animations: "disabled",
      });
    }
  };
  await page.goto(`/scenarios/catalog?q=${row.externalId}`);
  await expect(page.locator(".catalog")).toHaveAttribute("aria-busy", "false");
  await page
    .locator(`[data-scenario-id="${row.id}"]`)
    .locator(".record-title")
    .click();
  await expect(panel.getByText(row.externalId, { exact: true })).toBeVisible();
  await tabs.getByText("Технологический радар", { exact: true }).press("Enter");
  const radarPoint = page.locator(`.radar-point[data-scenario="${row.id}"]`);
  await expect(radarPoint).toHaveAttribute("aria-pressed", "true");
  await expect(panel.getByText(row.externalId, { exact: true })).toBeVisible();
  if (page.viewportSize()!.width >= 1366) {
    await expect(page.locator(".direction-label")).toHaveCount(8);
    await expect(page.locator("[data-inspector-fit]").first()).toBeVisible();
    const clipped = await page
      .locator(".direction-label span")
      .evaluateAll((labels) =>
        labels.some((label) => label.scrollHeight > label.clientHeight + 1),
      );
    expect(clipped).toBe(false);
  }
  await expect(
    page.locator(".radar-marker-layer > :last-child [data-selection-halo]"),
  ).toHaveCount(1);
  await expect
    .poll(async () => Math.max(...(await labelLengths())))
    .toBeLessThanOrEqual(120.01);
  await capture("radar-from-catalog");

  await panel.getByRole("button", { name: "Свернуть инспектор" }).click();
  const handle = (await panel.getByRole("heading").boundingBox())!;
  await page.mouse.move(handle.x + 8, handle.y + 8);
  await page.mouse.down();
  await page.mouse.move(160, 400, { steps: 8 });
  await page.mouse.up();
  await expect(panel).toHaveAttribute(
    "data-floating-scenario-inspector",
    "true",
  );
  await panel.getByRole("button", { name: "Развернуть инспектор" }).click();
  await expect(radarPoint).toHaveAttribute("aria-pressed", "true");
  await panel.getByLabel("Закрыть инспектор").click();
  await expect(page.locator("[data-selection-halo]")).toHaveCount(0);
  await page.goto("/scenarios/radar?q=SYN-");
  await ready(page);

  const otherPoint = page.locator(`.radar-point[data-scenario="${other.id}"]`);
  await otherPoint.press("Enter");
  await expect(
    panel.getByText(other.externalId, { exact: true }),
  ).toBeVisible();
  await expect(otherPoint).toHaveAttribute("aria-pressed", "true");
  await capture("radar-direct");
  await page
    .locator(".density-switch")
    .getByText("Группы", { exact: true })
    .press("Enter");
  await expect(
    page.locator(".radar-marker-layer [data-selection-halo]").first(),
  ).toBeAttached();
  await expect(
    panel.getByText(other.externalId, { exact: true }),
  ).toBeVisible();

  await tabs.getByText("Каталог", { exact: true }).press("Enter");
  await expect(
    panel.getByText(other.externalId, { exact: true }),
  ).toBeVisible();
  await tabs.getByText("Матрица зрелости", { exact: true }).press("Enter");
  const matrixPoint = page.locator(
    `.matrix-point[data-scenario="${other.id}"]`,
  );
  await expect(matrixPoint).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(".matrix-points-layer > :last-child [data-selection-halo]"),
  ).toHaveCount(1);
  await capture("matrix-selection");
  await page
    .locator(".matrix-switch")
    .getByText("Ячейки", { exact: true })
    .press("Enter");
  const cell = page.locator(
    `[data-cell="${other.maturity}:${other.readiness}"]`,
  );
  await expect(cell).toHaveAttribute("data-selected-scenario", "true");
  await expect(
    panel.getByText(other.externalId, { exact: true }),
  ).toBeVisible();
  await page
    .locator(".matrix-switch")
    .getByText("Точки", { exact: true })
    .press("Enter");
  await expect(matrixPoint).toHaveAttribute("aria-pressed", "true");
  await panel.getByLabel("Закрыть инспектор").click();
  await expect(page.locator("[data-selection-halo]")).toHaveCount(0);

  await page.goto(
    `/scenarios/radar?q=SYN-&zoom=8&panX=-4000&selected=${row.id}`,
  );
  await expect(radarPoint).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("camera")).toHaveAttribute("data-zoom", "8");
  await expect
    .poll(() =>
      radarPoint.evaluate((element) => {
        const point = element.getBoundingClientRect();
        const plot = element.closest("svg")!.getBoundingClientRect();
        return (
          point.left >= plot.left &&
          point.right <= plot.right &&
          point.top >= plot.top &&
          point.bottom <= plot.bottom
        );
      }),
    )
    .toBe(true);
  await expect(page.locator(".direction-label").nth(3)).toHaveCount(0);
  const camera = page.locator(".interactive-radar");
  await camera.press("ArrowDown");
  await expect(page).toHaveURL(/panY=/);
  await expect(radarPoint).toHaveAttribute("aria-pressed", "true");

  const missing = data.rows.find((item) => item.maturity === null)!;
  await page.goto(`/scenarios/radar?q=SYN-&selected=${missing.id}`);
  await expect(page.locator(".analytics-selection-note")).toBeVisible();
  await expect(page.locator("[data-selection-halo]")).toHaveCount(0);
  await tabs.getByText("Матрица зрелости", { exact: true }).press("Enter");
  await expect(page.locator(".analytics-selection-note")).toBeVisible();
  await expect(page.locator("[data-selection-halo]")).toHaveCount(0);
});
