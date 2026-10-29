import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await expect(page.locator(".shared-filters")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".catalog")).toHaveAttribute("aria-busy", "false");
}
test("catalog defaults, sortable headings, paging and consistent scores", async ({
  page,
}) => {
  await page.goto("/scenarios/catalog");
  await ready(page);
  await expect(page.locator(".catalog tbody tr")).toHaveCount(25);
  await expect(page.getByLabel("Строк на странице")).toHaveValue("25");
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
  await page.getByLabel("Строк на странице").selectOption("50");
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
