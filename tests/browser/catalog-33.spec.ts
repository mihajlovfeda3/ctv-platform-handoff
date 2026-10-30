import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await expect(page.locator(".shared-filters")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".catalog")).toHaveAttribute("aria-busy", "false");
  await page
    .locator(".catalog")
    .evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))),
    );
}
test("catalog defaults, sortable headings, paging and consistent scores", async ({
  page,
}) => {
  await page.goto("/scenarios/catalog");
  await ready(page);
  await expect(page.locator(".catalog tbody tr")).toHaveCount(25);
  await expect(
    page.getByRole("button", { name: "Строк на странице" }),
  ).toHaveText("25");
  await expect(page.locator(".catalog tbody tr").last()).toBeVisible();
  const heights = await page
    .locator(".catalog tbody tr")
    .evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().height));
  expect(Math.max(...heights)).toBeLessThanOrEqual(68);
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(60);
  const scores = await page
    .locator(".catalog tbody tr")
    .first()
    .locator("td")
    .allTextContents();
  expect(scores[1]).toMatch(/^(—|[1-5]\/5)$/);
  expect(scores[2]).toMatch(/^(—|[1-7]\/7)$/);
  expect(scores[3]).toMatch(/^(—|[1-3]\/3)$/);
  for (const [label, key] of [
    ["ID", "id"],
    ["РЗ", "maturity"],
    ["ОГ", "readiness"],
    ["Влияние на бизнес-цели", "impact"],
  ]) {
    await page
      .getByRole("link", { name: `Сортировать: ${label}`, exact: true })
      .click();
    const first = new URL(page.url()).searchParams.get("order");
    await expect(page).toHaveURL(new RegExp(`sort=${key}`));
    await page
      .getByRole("link", { name: `Сортировать: ${label}`, exact: true })
      .click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("order"))
      .not.toBe(first);
  }
  await page.getByRole("button", { name: "Строк на странице" }).click();
  await page.getByRole("option", { name: "50", exact: true }).click();
  await expect(page.locator(".catalog tbody tr")).toHaveCount(50);
  await page
    .getByRole("link", { name: "Следующая страница", exact: true })
    .click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator(".catalog tbody tr")).toHaveCount(30);
  await page
    .getByRole("link", { name: "Предыдущая страница", exact: true })
    .click();
  await expect(page).toHaveURL(/page=1/);
});
test("shared filters, removable constraints and empty state", async ({
  page,
}) => {
  await page.goto("/scenarios/catalog?q=SYN-&implementation=yes");
  await ready(page);
  await expect(page.locator(".filter-chips a")).toHaveCount(2);
  await page.locator(".advanced-filters summary").click();
  await page.locator("[name=maturityMin]").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/maturityMin=2/);
  await expect(page.locator(".filter-chips")).toContainText("РЗ: 2–5");
  await page
    .getByRole("link", { name: "Снять фильтр: РЗ: 2–5", exact: true })
    .click();
  await expect(page).not.toHaveURL(/maturityMin=/);
  for (const title of [
    "Технологический радар",
    "Матрица зрелости",
    "Каталог",
  ]) {
    await page
      .getByRole("navigation", { name: "Представления сценариев" })
      .getByRole("link", { name: title, exact: true })
      .click();
    await expect(
      page.locator('.scenario-tabs [aria-current="page"]'),
    ).toHaveText(title);
    await expect(
      page.locator(
        ".scenario-workspace > .catalog, .scenario-workspace > .analytical-stage",
      ),
    ).toHaveCSS("animation-duration", "0.18s");
    await expect(page).toHaveURL(/implementation=yes/);
    await expect(page).toHaveURL(/q=SYN-/);
  }
  await page
    .getByRole("link", { name: "Снять фильтр: Реализуется", exact: true })
    .click();
  await expect(page).not.toHaveURL(/implementation=/);
  await page.locator("[name=q]").fill("zzzz-no-such-scenario");
  await expect(
    page.getByText("Сценарии не найдены", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Сбросить фильтры", exact: true })
    .click();
  await expect(page.locator(".catalog tbody tr")).toHaveCount(25);
});
test("row keyboard navigation, inspector updates, Esc and full card return retain scroll", async ({
  page,
}) => {
  await page.goto("/scenarios/catalog?q=SYN-&sort=id&order=asc");
  await ready(page);
  const rows = page.locator(".catalog tbody tr");
  await rows.nth(0).focus();
  await page.keyboard.press("ArrowDown");
  await expect(rows.nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  const panel = page.getByRole("region", { name: "Быстрый просмотр сценария" });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS("width", "420px");
  const id = await rows.nth(1).getAttribute("data-scenario-id");
  await expect(rows.nth(1)).toHaveAttribute("aria-selected", "true");
  const documents: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "document") documents.push(r.url());
  });
  await rows.nth(2).getByRole("link").first().click();
  await expect(panel.locator(".inspector-top")).toContainText("SYN-0003");
  expect(documents).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/q=SYN-/);
  await rows.nth(16).getByRole("link").first().click();
  await expect(panel).toBeVisible();
  const top = await page.evaluate(() => scrollY);
  expect(top).toBeGreaterThan(100);
  await panel.getByRole("link", { name: "Открыть полную карточку →" }).click();
  await page.getByRole("link", { name: "← Вернуться к выборке" }).click();
  await expect(panel).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(top, 0);
  expect(new URL(page.url()).searchParams.get("sort")).toBe("id");
  expect(id).toBeTruthy();
});

test("view titles, ID hierarchy and searchable keyboard-accessible filters", async ({
  page,
}) => {
  await page.goto("/scenarios/catalog");
  await ready(page);
  await expect(page.locator("h1")).toHaveText("Каталог сценариев");
  await expect(page.locator(".catalog h2, .catalog-keyboard-hint")).toHaveCount(
    0,
  );
  await expect(page.locator(".scenario-tabs a")).toHaveText([
    "Каталог",
    "Технологический радар",
    "Матрица зрелости",
  ]);
  await expect(page.locator(".catalog th")).toHaveCount(5);
  await expect(page.locator(".catalog th").first()).toHaveText(/ID/);
  const row = page.locator(".catalog tbody tr").first();
  const idBox = await row.locator(".record-id").boundingBox();
  const nameBox = await row.locator(".record-title").boundingBox();
  expect(idBox!.y + idBox!.height).toBeLessThanOrEqual(nameBox!.y);
  await row.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".catalog-inspector")).toBeVisible();
  const selected = new URL(page.url()).searchParams.get("selected");
  const technology = page.getByRole("button", {
    name: "ТЕХНОЛОГИЧЕСКОЕ НАПРАВЛЕНИЕ",
    exact: true,
  });
  await technology.focus();
  await page.keyboard.press("ArrowDown");
  const search = page.getByRole("combobox", {
    name: "Поиск: ТЕХНОЛОГИЧЕСКОЕ НАПРАВЛЕНИЕ",
  });
  await expect(search).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".catalog-inspector")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".catalog-inspector")).toHaveCount(0);
  await technology.focus();
  await page.keyboard.press("ArrowDown");
  await expect(search).toBeFocused();
  await search.fill("нет-такого-направления");
  await expect(page.getByRole("status")).toHaveText("Ничего не найдено");
  await search.fill("Искусственный интеллект");
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/directionId=/);
  await ready(page);
  await expect(page.locator(".filter-chips")).toContainText(
    "Искусственный интеллект",
  );
  await expect(technology).toBeFocused();
  await technology.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(technology).toBeFocused();
  await page.locator(".advanced-filters summary").click();
  await page
    .getByRole("button", { name: "БИЗНЕС-НАПРАВЛЕНИЕ", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Поиск: БИЗНЕС-НАПРАВЛЕНИЕ" })
    .fill("энергетика");
  await expect(page.getByRole("option")).toHaveCount(2);
  await page.locator("h1").click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  for (const [title, heading] of [
    ["Технологический радар", "Технологический радар"],
    ["Матрица зрелости", "Матрица зрелости"],
    ["Каталог", "Каталог сценариев"],
  ]) {
    await page
      .locator(".scenario-tabs")
      .getByRole("link", { name: title, exact: true })
      .click();
    await expect(page.locator("h1")).toHaveText(heading);
    await expect(page).toHaveURL(/directionId=/);
  }
  expect(selected).toBeTruthy();
});

test("column headers and database ordering agree without a separate sort control", async ({
  page,
  request,
}, info) => {
  await page.goto("/scenarios/catalog");
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Сортировка", exact: true }),
  ).toHaveCount(0);
  if (info.project.name !== "768")
    expect(
      (await page.locator(".scenario-table").boundingBox())!.y,
    ).toBeLessThan(315);
  for (const [key, label] of [
    ["name", "Название"],
    ["id", "ID"],
    ["maturity", "РЗ"],
    ["readiness", "ОГ"],
    ["impact", "Влияние на бизнес-цели"],
  ]) {
    for (const order of ["asc", "desc"]) {
      await page
        .getByRole("link", { name: `Сортировать: ${label}`, exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`sort=${key}`));
      await expect
        .poll(() => new URL(page.url()).searchParams.get("order"))
        .toBe(order);
      const data = await (
        await request.get(
          `/api/scenarios?sort=${key}&order=${order}&pageSize=25`,
        )
      ).json();
      await expect(page.locator(".catalog tbody tr").first()).toHaveAttribute(
        "data-scenario-id",
        data.items[0].id,
      );
      await expect(
        page.locator(
          ".catalog th[aria-sort=ascending], .catalog th[aria-sort=descending]",
        ),
      ).toHaveCount(1);
      await expect(page.locator(".catalog th svg")).toHaveCount(1);
      await expect(
        page.locator(".catalog th[aria-sort]").filter({
          has: page.getByRole("link", {
            name: `Сортировать: ${label}`,
            exact: true,
          }),
        }),
      ).toHaveAttribute(
        "aria-sort",
        order === "asc" ? "ascending" : "descending",
      );
    }
  }
});

test("single impact range, clean advanced filters and dropdown layout", async ({
  page,
  request,
}) => {
  for (const [lo, hi] of [
    [1, 1],
    [2, 2],
    [3, 3],
    [1, 2],
    [2, 3],
    [1, 3],
  ]) {
    await page.goto(`/scenarios/catalog?impactMin=${lo}&impactMax=${hi}`);
    await ready(page);
    await page.locator(".advanced-filters summary").click();
    await expect(page.locator("[name=impactMin]")).toHaveCount(1);
    await expect(page.locator("[name=impactMax]")).toHaveValue(String(hi));
    await expect(page.locator("[name=impactMin]")).toHaveValue(String(lo));
    await expect(
      page.getByRole("button", { name: "Влияние: точное значение" }),
    ).toHaveCount(0);
    await expect(page.locator("[name=context]")).toHaveCount(0);
    await expect(
      page.getByLabel("Бизнес-процесс / этап", { exact: true }),
    ).toHaveCount(0);
    const data = await (
      await request.get(
        `/api/scenarios?impactMin=${lo}&impactMax=${hi}&pageSize=50`,
      )
    ).json();
    for (const item of data.items) {
      const v = item.assessments.find(
        (a: { metric: string }) => a.metric === "business_impact",
      ).value;
      expect(v).toBeGreaterThanOrEqual(lo);
      expect(v).toBeLessThanOrEqual(hi);
    }
    await expect(page.locator(".catalog-count strong")).toHaveText(
      String(data.total),
    );
  }
  await page.goto("/scenarios/catalog?impact=3");
  await ready(page);
  await page.locator(".advanced-filters summary").click();
  await page.locator("[name=impactMin]").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/impactMin=2/);
  expect(new URL(page.url()).searchParams.has("impact")).toBe(false);
  await page.locator("[name=impactMin]").focus();
  await page.keyboard.press("Home");
  await expect
    .poll(() => new URL(page.url()).searchParams.has("impactMin"))
    .toBe(false);
  await ready(page);
  await expect(page.locator(".catalog-count strong")).toHaveText("80");
  await page
    .getByRole("button", { name: "БИЗНЕС-НАПРАВЛЕНИЕ", exact: true })
    .click();
  const box = (await page.locator(".ctv-select-popover").boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(380);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page
    .getByRole("combobox", { name: "Поиск: БИЗНЕС-НАПРАВЛЕНИЕ" })
    .fill("Система управления");
  await expect(page.getByRole("option")).toHaveCount(1);
  expect(
    await page
      .getByRole("option")
      .evaluate((n) => n.scrollWidth <= n.clientWidth),
  ).toBe(true);
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("catalog sections share one left edge in every sidebar state", async ({
  page,
}) => {
  await page.goto("/scenarios/catalog");
  await ready(page);
  const checkAlignment = async () => {
    const x = await page
      .locator(".breadcrumb")
      .evaluate((el) => el.getBoundingClientRect().left);
    for (const selector of [
      ".catalog-page h1",
      ".scenario-tabs",
      ".catalog-filters",
      ".scenario-search",
      ".catalog",
      ".catalog-count",
      ".scenario-table",
    ]) {
      await expect
        .poll(async () =>
          Math.abs((await page.locator(selector).boundingBox())!.x - x),
        )
        .toBeLessThan(0.5);
    }
  };
  await checkAlignment();
  await page
    .getByRole("button", { name: "Свернуть панель", exact: true })
    .click();
  await page.mouse.move(page.viewportSize()!.width - 30, 60);
  await expect
    .poll(() =>
      page
        .locator(".main-shell")
        .evaluate((el) => el.getBoundingClientRect().left),
    )
    .toBe(76);
  await checkAlignment();
  const compactLeft = (await page.locator(".catalog").boundingBox())!.x;
  await page.mouse.move(1, 350);
  await expect(page.locator(".nav-peek")).toBeVisible();
  await checkAlignment();
  expect((await page.locator(".catalog").boundingBox())!.x).toBe(compactLeft);
  await page
    .getByRole("button", { name: "Закрепить панель", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Свернуть панель", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".main-shell")
        .evaluate((el) => el.getBoundingClientRect().left),
    )
    .toBe(224);
  await checkAlignment();
});
