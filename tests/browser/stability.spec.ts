import { test, expect, type Page } from "@playwright/test";
const search = () => ({ q: "SYN-0012", context: "synthetic-lab" });
async function settled(page: Page) {
  await expect(page.locator(".shared-filters")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  if (await page.locator(".catalog").count()) {
    await expect(page.locator(".catalog")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await page
      .locator(".catalog")
      .evaluate((el) =>
        Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))),
      );
  }
  if (await page.locator(".analytical-stage").count()) {
    await page
      .locator(".analytical-stage")
      .evaluate((el) =>
        Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))),
      );
  }
}
async function checkScroll(
  page: Page,
  action: () => Promise<unknown>,
  top = 120,
  sameGeometry = true,
) {
  await settled(page);
  await expect
    .poll(() =>
      page.evaluate((y) => {
        window.scrollTo({ top: y, behavior: "instant" });
        return scrollY;
      }, top),
    )
    .toBeGreaterThan(0);
  const before = await page.evaluate(() => ({
    y: scrollY,
    height: document.documentElement.scrollHeight,
    history: history.length,
  }));
  expect(before.y).toBeGreaterThan(0);
  await action();
  await settled(page);
  const after = await page.evaluate(() => ({
    y: scrollY,
    height: document.documentElement.scrollHeight,
    history: history.length,
  }));
  if (sameGeometry) expect(after.height).toBe(before.height);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2);
  return { before, after };
}
test("mode preserves scroll, history, selection and context with inspector open/closed", async ({
  page,
  request,
}) => {
  const data = await (await request.get("/api/scenarios?q=SYN-0012")).json();
  const id = data.items[0].id;
  for (const inspector of [false, true]) {
    await page.goto(
      "/scenarios/radar?" +
        new URLSearchParams({
          ...search(),
          mode: "groups",
          ...(inspector ? { selected: id } : {}),
        }),
    );
    await page.locator(".quick-scenarios summary").click();
    if (inspector)
      await expect(
        page.getByRole("region", { name: "Быстрый просмотр сценария" }),
      ).toBeVisible();
    const change = await checkScroll(page, async () => {
      await page.getByRole("link", { name: "Точки", exact: true }).click();
      await expect(page).toHaveURL(/mode=points/);
    });
    expect(change.after.history).toBe(change.before.history);
    console.log(
      JSON.stringify({
        viewport: page.viewportSize(),
        inspector,
        scrollBefore: change.before.y,
        scrollAfter: change.after.y,
        delta: Math.abs(change.after.y - change.before.y),
      }),
    );
    expect(new URL(page.url()).searchParams.get("q")).toBe("SYN-0012");
    expect(new URL(page.url()).searchParams.get("context")).toBe(
      "synthetic-lab",
    );
    if (inspector) {
      expect(new URL(page.url()).searchParams.get("selected")).toBe(id);
      await checkScroll(page, async () => {
        await page.keyboard.press("Escape");
        await expect(
          page.getByRole("region", { name: "Быстрый просмотр сценария" }),
        ).toHaveCount(0);
      });
    }
  }
});
test("all exact scores clear ranges, invalid bounds stay inline, deep links remain usable", async ({
  page,
}) => {
  await page.goto("/scenarios/catalog");
  await page.locator(".advanced-filters summary").click();
  await page.locator("[name=impactMax]").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/impactMax=2/);
  await settled(page);
  await page.goto("/scenarios/catalog?impact=3");
  await settled(page);
  await page.locator(".advanced-filters summary").click();
  await expect(page.locator("[name=impactMin]")).toHaveValue("3");
  await page.locator("[name=impactMin]").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/impactMin=2/);
  await settled(page);
  expect(new URL(page.url()).searchParams.has("impact")).toBe(false);
  await expect(page.locator("[name=impactMax]")).toHaveValue("3");
  await page.goto("/scenarios/catalog?readinessMin=6&readinessMax=4");
  await expect(page.locator("#error-readinessMax")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Каталог сценариев", exact: true }),
  ).toBeVisible();
});
test("sidebar separates disclosure from navigation and preserves query in collapsed links", async ({
  page,
  request,
}) => {
  const data = await (await request.get("/api/scenarios?q=SYN-0012")).json();
  const id = data.items[0].id;
  await page.goto(
    "/scenarios/radar?" +
      new URLSearchParams({ ...search(), selected: id, mode: "points" }),
  );
  const nav = page.locator("#scenario-subnav");
  const initial = page.url();
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("link", { name: "Сценарии", exact: true })
    .hover();
  await expect(nav).toBeVisible();
  expect(page.url()).toBe(initial);
  await page.getByRole("button", { name: "Свернуть панель" }).click();
  await expect(nav).toHaveCount(0);
  await expect(page.locator(".submenu-toggle")).toHaveCount(0);
  await expect
    .poll(() =>
      page.locator(".sidebar").evaluate((n) => n.getBoundingClientRect().width),
    )
    .toBe(76);
  await page.mouse.move(1, 350);
  await expect(page.locator(".nav-peek")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("link", { name: "Сценарии", exact: true })
    .hover();
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Каталог", exact: true }).click();
  await expect(page).toHaveURL(/\/catalog\?/);
  for (const [key, value] of Object.entries({
    ...search(),
    selected: id,
    mode: "points",
  }))
    expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  await expect(
    nav.getByRole("link", { name: "Каталог", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    nav.getByRole("link", { name: "Матрица зрелости", exact: true }),
  ).toHaveAttribute("title", "Матрица зрелости");
  await nav
    .getByRole("link", { name: "Матрица зрелости", exact: true })
    .click();
  await expect(page).toHaveURL(/\/maturity\?/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("inspector open/close, sort/reset and card return preserve intended scroll/context", async ({
  page,
  request,
}) => {
  const data = await (await request.get("/api/scenarios?q=SYN-0012")).json();
  const id = data.items[0].id;
  await page.goto("/scenarios/radar?" + new URLSearchParams(search()));
  await page.locator(".quick-scenarios summary").click();
  await page.locator(".quick-grid a").first().scrollIntoViewIfNeeded();
  await checkScroll(
    page,
    async () => {
      await page.locator(".quick-grid a").first().click();
      await expect(
        page.getByRole("region", { name: "Быстрый просмотр сценария" }),
      ).toBeVisible();
    },
    await page.evaluate(() => scrollY),
  );
  await page
    .getByRole("link", { name: "Открыть полную карточку →" })
    .scrollIntoViewIfNeeded();
  const returnY = await page.evaluate(() => scrollY);
  await page.getByRole("link", { name: "Открыть полную карточку →" }).click();
  await expect(page).toHaveURL(new RegExp(`/scenarios/${id}`));
  await page.getByRole("link", { name: "← Вернуться к выборке" }).click();
  await expect(page).toHaveURL(/\/radar\?/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(returnY, 0);
  await page.keyboard.press("Escape");
  await settled(page);
  await page.goto("/scenarios/catalog?q=SYN-");
  await expect(page.locator(".catalog tbody tr")).toHaveCount(25);
  await checkScroll(
    page,
    async () => {
      await page
        .getByRole("link", { name: "Сортировать: Название", exact: true })
        .click();
      await expect(page).toHaveURL(/sort=name/);
    },
    120,
    false,
  );
  await checkScroll(
    page,
    async () => {
      await page.getByRole("link", { name: "Сбросить", exact: true }).click();
      await expect(page).toHaveURL(/sort=name/);
      await expect
        .poll(() => new URL(page.url()).searchParams.has("q"))
        .toBe(false);
    },
    120,
    false,
  );
});
test("overview link and screenshots", async ({ page }, info) => {
  await page.goto("/overview");
  await page.getByRole("link", { name: "Открыть каталог сценариев" }).click();
  await expect(page).toHaveURL(/\/scenarios\/catalog/);
  if (process.env.SAVE_UX_SCREENSHOTS) {
    for (const view of ["catalog", "radar", "maturity"]) {
      await page.goto(`/scenarios/${view}`);
      await expect(page.locator(".shared-filters")).toBeVisible();
      await settled(page);
      await page.screenshot({
        path: `docs/screenshots/2a1/${view}-${info.project.name}.jpg`,
        fullPage: true,
      });
    }
  }
});
