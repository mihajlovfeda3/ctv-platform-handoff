import { test, expect, type Page } from "@playwright/test";
import { contextualSectors } from "../../src/domain/radar-labels";

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
  await page.locator(".interactive-radar").evaluate((el, z) => {
    const old = Number(
      el.querySelector("[data-testid=camera]")!.getAttribute("data-zoom"),
    );
    const b = el.getBoundingClientRect();
    el.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: Math.log(old / z) / 0.002,
        clientX: b.left + b.width / 2,
        clientY: b.top + b.height / 2,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, target);
  await expect
    .poll(async () =>
      Number(
        await page.locator("[data-testid=camera]").getAttribute("data-zoom"),
      ),
    )
    .toBeCloseTo(target, 5);
}

test("compact default points, lighter labels and contextual information", async ({
  page,
}) => {
  await page.goto("/scenarios/radar");
  await ready(page);
  await expect(
    page.locator('.density-switch [aria-current="true"]'),
  ).toHaveText("Точки");
  await expect(page.locator("circle[data-scenario]").first()).toBeVisible();
  await expect(page.locator(".analytical-heading h2")).toHaveCount(0);
  await expect(
    page.locator(
      ".shared-filter-row > label, .shared-filter-row > .filter-field",
    ),
  ).toHaveCount(3);
  await expect(page.locator("[name=readinessMin]")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Сброс масштаба" }),
  ).toHaveCount(0);
  await expect(page.locator(".direction-label").first()).toHaveCSS(
    "border-top-width",
    "0px",
  );
  await expect(page.locator(".radar-summary-bar")).not.toContainText("Размер", {
    useInnerText: true,
  });
  await expect(page.locator(".radar-summary-bar")).not.toContainText("Без ОГ", {
    useInnerText: true,
  });
  await page.locator("circle[data-scenario]").first().press("Enter");
  await expect(
    page.getByRole("region", { name: "Быстрый просмотр сценария" }),
  ).toBeVisible();
  await expect(
    page.locator('.density-switch [aria-current="true"]'),
  ).toHaveText("Точки");
  const selected = new URL(page.url()).searchParams.get("selected");
  await page.getByRole("button", { name: "О диаграмме и выборке" }).click();
  await expect(page.locator(".radar-info-popover")).toBeVisible();
  await expect(page.locator(".radar-info-popover")).toContainText(
    "влияние на бизнес-цели от 1 до 3",
  );
  await expect(page.locator(".radar-info-popover")).toContainText(
    "синтетические",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".radar-info-popover")).toBeHidden();
  expect(new URL(page.url()).searchParams.get("selected")).toBe(selected);
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Группы", exact: true }).click();
  await expect(page.locator(".radar-mark").first()).toBeVisible();
  await page.locator(".radar-group").first().press("Enter");
  await expect(page.getByLabel("Состав выбранной группы")).toBeVisible();
});

test("shared filters and explicit groups survive inspector and view navigation", async ({
  page,
  request,
}) => {
  await page.goto("/scenarios/radar?mode=groups&q=SYN-");
  await ready(page);
  await expect(
    page.locator('.density-switch [aria-current="true"]'),
  ).toHaveText("Группы");
  await page.locator(".advanced-filters summary").click();
  await expect(
    page.getByRole("button", { name: "БЛОК „ГАЗПРОМ НЕФТЬ“", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[name=context]")).toBeVisible();
  await page.locator("[name=maturityMin]").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/maturityMin=2/);
  await page.getByRole("link", { name: "Точки", exact: true }).click();
  const refs = await (await request.get("/api/references")).json();
  await page
    .getByRole("button", { name: "ТЕХНОЛОГИЧЕСКОЕ НАПРАВЛЕНИЕ", exact: true })
    .click();
  await page
    .getByRole("option", { name: refs.directions[0].name, exact: true })
    .click();
  await expect(page).toHaveURL(/directionId=/);
  await expect(page.locator(".shared-filters")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const params = new URL(page.url()).searchParams;
  const data = await (
    await request.get("/api/scenarios/analytics?" + params)
  ).json();
  const expected = data.rows
    .filter((r: { maturity: number | null }) => r.maturity !== null)
    .reduce(
      (n: number, r: { directions: unknown[] }) => n + r.directions.length,
      0,
    );
  await expect(page.locator("circle[data-scenario]")).toHaveCount(expected);
  await page.locator("circle[data-scenario]").first().press("Enter");
  await expect(
    page.getByRole("region", { name: "Быстрый просмотр сценария" }),
  ).toBeVisible();
  const groupMode = page.getByRole("link", { name: "Группы", exact: true });
  await page.evaluate(() => window.scrollTo({ top: 120, behavior: "instant" }));
  const scrollBeforeMode = await page.evaluate(() => scrollY);
  await groupMode.click();
  await expect(
    page.locator('.density-switch [aria-current="true"]'),
  ).toHaveText("Группы");
  await expect(groupMode).toBeFocused();
  expect(
    Math.abs((await page.evaluate(() => scrollY)) - scrollBeforeMode),
  ).toBeLessThanOrEqual(2);
  for (const title of [
    "Каталог",
    "Матрица зрелости",
    "Технологический радар",
  ]) {
    if (page.viewportSize()!.width < 1000) {
      // The accepted catalogue inspector overlays its tabs on narrow screens;
      // use the available global subnavigation without changing that layout.
      await page
        .locator(".sidebar")
        .getByRole("link", { name: "Сценарии", exact: true })
        .hover();
      await page
        .locator("#scenario-subnav")
        .getByRole("link", { name: title, exact: true })
        .click();
    } else {
      await page
        .locator(".scenario-tabs")
        .getByRole("link", { name: title, exact: true })
        .click();
    }
    await expect(
      page.locator('.scenario-tabs [aria-current="page"]'),
    ).toHaveText(title);
    await expect(page).toHaveURL(/maturityMin=2/);
    await expect(page).toHaveURL(/directionId=/);
    await expect(page).toHaveURL(/selected=/);
  }
});

test("1/3/8x, pan, contextual labels and sidebar keep camera gestures local", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/scenarios/radar?q=SYN-");
  await ready(page);
  const calls: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (
      u.pathname.startsWith("/api/scenarios") ||
      (u.pathname.startsWith("/scenarios/") && u.searchParams.has("_rsc"))
    )
      calls.push(r.url());
  });
  const svg = page.locator(".interactive-radar");
  for (const z of [1, 3, 8]) {
    await zoom(page, z);
    if (z > 1)
      await expect(
        page.getByRole("button", { name: "Сброс масштаба" }),
      ).toBeVisible();
    await svg.scrollIntoViewIfNeeded();
    const box = (await svg.boundingBox())!;
    await page.mouse.move(box.x + 3, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 70, box.y + box.height / 2 + 20, {
      steps: 4,
    });
    await page.mouse.up();
    const c = page.locator("[data-testid=camera]");
    const camera = {
      z,
      x: Number(await c.getAttribute("data-pan-x")),
      y: Number(await c.getAttribute("data-pan-y")),
    };
    const expected = contextualSectors(
      camera,
      { width: box.width, height: box.height },
      8,
    )
      .map((s) => String(s.index))
      .sort();
    await expect(page.locator(".direction-label").first()).toBeVisible();
    const shown = await page
      .locator(".direction-label")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-sector")),
      );
    expect(expected).toEqual(expect.arrayContaining(shown));
    await expect(page.locator(".direction-leaders line")).toHaveCount(
      shown.length,
    );
    await page.locator(".direction-label").first().hover();
    await expect(
      page.locator(".radar-sector[data-highlighted=true]"),
    ).toHaveCount(1);
  }
  await page.getByRole("button", { name: "Сброс масштаба" }).click();
  await expect(
    page.getByRole("button", { name: "Сброс масштаба" }),
  ).toHaveCount(0);
  const before = (await svg.boundingBox())!.width;
  await page
    .getByRole("button", { name: "Свернуть панель", exact: true })
    .click();
  await page.mouse.move(page.viewportSize()!.width - 30, 60);
  await expect
    .poll(async () => (await svg.boundingBox())!.width)
    .toBeGreaterThan(before);
  await expectRestingLabels(page);
  await page
    .getByRole("button", { name: "Развернуть панель", exact: true })
    .click();
  await expect
    .poll(async () => (await svg.boundingBox())!.width)
    .toBeCloseTo(before, 1);
  expect(calls).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
