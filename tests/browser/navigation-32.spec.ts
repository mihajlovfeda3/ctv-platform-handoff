import { test, expect } from "@playwright/test";
test("overview header, unified icon, links and responsive layout", async ({
  page,
}) => {
  await page.goto("/overview");
  await expect(page.locator(".topbar")).toHaveCount(0);
  expect(
    await page
      .locator("[data-overview-environment]")
      .evaluate((n) => n.getBoundingClientRect().top),
  ).toBe(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Единое пространство для технологической аналитики и планирования",
  );
  const nav = page.getByRole("navigation", { name: "Рабочие разделы" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.getByRole("link").first()).toHaveAttribute(
    "href",
    "/scenarios/catalog",
  );
  const icons = await page
    .locator(
      '.sidebar .lucide-scan-line, nav[aria-label="Рабочие разделы"] .lucide-scan-line',
    )
    .evaluateAll((ns) => ns.map((n) => n.innerHTML));
  expect(icons).toHaveLength(2);
  expect(icons[0]).toBe(icons[1]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await nav
    .getByRole("link")
    .filter({
      has: page.getByRole("heading", {
        name: "Технологии и рынок",
        exact: true,
      }),
    })
    .click();
  await expect(page).toHaveURL(/technologies/);
  await expect(page.locator(".topbar")).toBeVisible();
});
test("hover, double click pin/unpin and keyboard navigation preserve link semantics", async ({
  page,
}) => {
  await page.goto("/overview");
  const group = page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("link", { name: "Сценарии", exact: true });
  const sub = page.locator("#scenario-subnav");
  await expect(sub).toBeHidden();
  await expect(page.locator(".submenu-toggle")).toHaveCount(0);
  await group.hover();
  await expect(sub).toBeVisible();
  await page.mouse.move(700, 100);
  await expect(sub).toBeHidden();
  await group.dblclick();
  await page.mouse.move(700, 100);
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(/\/overview$/);
  await expect(sub).toBeVisible();
  await group.dblclick();
  await page.mouse.move(700, 100);
  await expect(sub).toBeHidden();
  await group.focus();
  await group.press(" ");
  await page.getByRole("link", { name: "Открыть каталог сценариев" }).focus();
  await page.mouse.move(700, 100);
  await expect(sub).toBeVisible();
  await group.focus();
  await group.press("ArrowLeft");
  await expect(sub).toBeHidden();
  await group.click();
  await expect(page).toHaveURL(/scenarios\/radar/);
  await group.hover();
  await group.click();
  await sub.getByRole("link", { name: "Каталог", exact: true }).click();
  await expect(page).toHaveURL(/scenarios\/catalog/);
  await page.waitForTimeout(450);
  await expect(page).toHaveURL(/scenarios\/catalog/);
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("link", { name: "Бизнес и задачи", exact: true })
    .press("Enter");
  await expect(page).toHaveURL(/business/);
});
test("compact rail, temporary overlay, disabled help and ordinary links", async ({
  page,
}) => {
  await page.goto("/technologies?q=SYN-&context=synthetic-lab");
  await page
    .getByRole("button", { name: "Свернуть панель", exact: true })
    .click();
  await page.mouse.move(700, 100);
  await expect(page.locator("#scenario-subnav")).toHaveCount(0);
  const help = page.getByRole("link", { name: /О платформе/ });
  await expect(help).toBeVisible();
  await expect(help).toHaveAttribute("aria-disabled", "true");
  await expect(help).not.toHaveAttribute("href");
  await expect
    .poll(() =>
      help.locator("svg").evaluate((n) => {
        const r = n.getBoundingClientRect();
        return r.x + r.width / 2;
      }),
    )
    .toBe(38);
  const before = (await page.locator(".main-shell").boundingBox())!;
  await page.mouse.move(1, 350);
  await expect(page.locator(".nav-peek")).toBeVisible();
  const group = page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("link", { name: "Сценарии", exact: true });
  await group.hover();
  await expect(page.locator("#scenario-subnav")).toBeVisible();
  expect(
    new URL(
      (await group.getAttribute("href")) ?? "",
      page.url(),
    ).searchParams.get("q"),
  ).toBe("SYN-");
  const after = (await page.locator(".main-shell").boundingBox())!;
  expect(after.x).toBe(before.x);
  expect(after.width).toBe(before.width);
  await page.mouse.move(700, 100);
  await expect(page.locator(".nav-peek")).toHaveCount(0);
  await expect(page.locator("#scenario-subnav")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("link", { name: "Обзор", exact: true })
    .click();
  await expect(page).toHaveURL(/overview/);
});
