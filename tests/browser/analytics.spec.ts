import { test, expect } from "@playwright/test";
test("range handles clamp, preserve legacy links and include unknown at defaults", async ({
  page,
  request,
}) => {
  await page.goto("/scenarios/catalog?readiness=7");
  await page.locator(".advanced-filters summary").click();
  await expect(page.locator("[name=readinessMin]")).toBeEnabled();
  await expect(page.locator("[name=readinessMin]")).toHaveValue("7");
  await page.locator("[name=readinessMin]").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/readinessMin=6/);
  expect(new URL(page.url()).searchParams.has("readiness")).toBe(false);
  await page.locator("[name=readinessMin]").focus();
  await page.keyboard.press("End");
  await expect(page).toHaveURL(/readinessMin=7/);
  await page.locator("[name=readinessMax]").focus();
  await page.keyboard.press("Home");
  await expect(page.locator("[name=readinessMax]")).toHaveValue("7");
  await page.goto("/scenarios/maturity?q=SYN-");
  const data = await (
    await request.get("/api/scenarios/analytics?q=SYN-")
  ).json();
  expect(
    data.rows.some((r: { maturity: number | null }) => r.maturity === null),
  ).toBe(true);
  await page.getByRole("button", { name: /Без РЗ или ОГ:/ }).click();
  await expect(page.locator(".group-members a").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Состав выбранной группы")).toHaveCount(0);
  await page.locator(".advanced-filters summary").click();
  await expect(
    page.getByLabel("Бизнес-процесс / этап", { exact: true }),
  ).toBeDisabled();
});
test("radar and matrix: whole dataset, zoom, pan, selection, ranges and card return", async ({
  page,
  request,
}, info) => {
  const t = Date.now();
  const data = await (
    await request.get("/api/scenarios/analytics?q=SYN-&pageSize=1")
  ).json();
  expect(data.total).toBe(Number(process.env.PERF_SIZE ?? 80));
  expect(data.rows).toHaveLength(data.total);
  await page.goto("/scenarios/radar?q=SYN-");
  const radar = page.locator(".interactive-radar");
  await expect(radar).toBeVisible();
  await page.locator(".radar-mark").first().click();
  await expect(page.getByLabel("Состав выбранной группы")).toBeVisible();
  await page.locator(".group-members a").first().click();
  await expect(
    page.getByRole("region", { name: "Быстрый просмотр сценария" }),
  ).toBeVisible();
  const selected = new URL(page.url()).searchParams.get("selected");
  await page.keyboard.press("Escape");
  await page.getByLabel("Закрыть группу").click();
  await expect(page.getByLabel("Состав выбранной группы")).toHaveCount(0);
  await radar.focus();
  await page.keyboard.press("+");
  await expect(page).toHaveURL(/zoom=1.25/);
  await radar.scrollIntoViewIfNeeded();
  const box = (await radar.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -120);
  await expect
    .poll(() => Number(new URL(page.url()).searchParams.get("zoom")))
    .toBeGreaterThan(1.25);
  await page.mouse.move(box.x + 10, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 65, box.y + 65, { steps: 5 });
  await page.mouse.up();
  await expect(page).toHaveURL(/panX=/);
  await page.getByRole("link", { name: "Точки", exact: true }).click();
  await expect(page.locator("circle[data-scenario]").first()).toBeVisible();
  console.log(
    JSON.stringify({
      size: data.total,
      markers: await page.locator("circle[data-scenario]").count(),
      heapBytes: await page.evaluate(() =>
        "memory" in performance
          ? (performance as unknown as { memory: { usedJSHeapSize: number } })
              .memory.usedJSHeapSize
          : null,
      ),
    }),
  );
  await page.getByRole("button", { name: "Сброс масштаба" }).click();
  await expect(page).toHaveURL(/zoom=1/);
  if (data.total > 1000)
    await page.locator("circle[data-scenario]").first().press("Enter");
  else await page.locator("circle[data-scenario]").first().click();
  await page.getByRole("link", { name: "Открыть полную карточку →" }).click();
  await page.getByRole("link", { name: "← Вернуться к выборке" }).click();
  await expect(page).toHaveURL(/\/scenarios\/radar\?/);
  await expect(page).toHaveURL(/selected=/);
  await expect(
    page.getByRole("region", { name: "Быстрый просмотр сценария" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("region", { name: "Быстрый просмотр сценария" }),
  ).toHaveCount(0);
  await page.locator("[name=maturityMin]").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.up("ArrowRight");
  await expect(page).toHaveURL(/maturityMin=2/);
  expect(new URL(page.url()).searchParams.has("maturity")).toBe(false);
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("link", { name: "Сценарии", exact: true })
    .hover();
  await page
    .locator("#scenario-subnav")
    .getByRole("link", { name: "Матрица зрелости" })
    .click();
  await expect(page.locator(".matrix-scatter")).toBeVisible();
  await expect(page).toHaveURL(/maturityMin=2/);
  await page
    .locator(".scatter-cell")
    .filter({ hasText: /^[1-9]/ })
    .first()
    .locator(".cell-count")
    .click();
  await expect(page.getByLabel("Состав выбранной группы")).toBeVisible();
  await page.locator(".group-members a").first().click();
  await expect(
    page.getByRole("region", { name: "Быстрый просмотр сценария" }),
  ).toBeVisible();
  expect(selected).toBeTruthy();
  console.log(
    JSON.stringify({
      size: data.total,
      viewport: info.project.name,
      journeyMs: Date.now() - t,
    }),
  );
  if (process.env.SAVE_UX_SCREENSHOTS && info.project.name === "1440") {
    await page.keyboard.press("Escape");
    await page.goto("/scenarios/maturity?q=SYN-");
    await expect(page.locator(".matrix-scatter")).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/2b/maturity.jpg",
      fullPage: true,
    });
    await page.goto("/scenarios/radar?q=SYN-&mode=points");
    await expect(page.locator("circle[data-scenario]").first()).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/2b/radar-points.jpg",
      fullPage: true,
    });
    await page.goto("/scenarios/radar?q=SYN-");
    await expect(page.locator(".radar-mark").first()).toBeVisible();
    await page.screenshot({
      path: "docs/screenshots/2b/radar-groups.jpg",
      fullPage: true,
    });
  }
});
