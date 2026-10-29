import { test, expect } from "@playwright/test";
test("overview composition, links, cursor light and reduced motion", async ({
  page,
}, info) => {
  await page.goto("/overview");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Единое пространство для технологической аналитики и планирования",
  );
  await expect(
    page.getByRole("navigation", { name: "Рабочие разделы" }).getByRole("link"),
  ).toHaveCount(4);
  for (const [name, url] of [
    ["Сценарии", "/scenarios/catalog"],
    ["Бизнес и задачи", "/business"],
    ["Технологии и рынок", "/technologies"],
    ["Внутренний портфель", "/portfolio"],
  ]) {
    const link = page
      .getByRole("navigation", { name: "Рабочие разделы" })
      .getByRole("link")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(link).toHaveAttribute("href", url);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (info.project.name === "1440")
    expect(
      await page
        .getByRole("navigation", { name: "Рабочие разделы" })
        .evaluate((n) => n.getBoundingClientRect().bottom),
    ).toBeLessThanOrEqual(900);
  await page.mouse.move(600, 250);
  await expect
    .poll(() =>
      page
        .locator("[data-overview-environment]")
        .evaluate((n) =>
          (n as HTMLElement).style.getPropertyValue("--light-x"),
        ),
    )
    .not.toBe("");
  await expect(
    page.getByText("Структура раздела", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Исследовать возможности", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator('nav[aria-label="Рабочие разделы"] svg'),
  ).toHaveCount(8);
  const first = await page
    .locator(".overview-illumination")
    .evaluate((n) => getComputedStyle(n).transform);
  await page.waitForTimeout(3200);
  expect(
    await page
      .locator(".overview-illumination")
      .evaluate((n) => getComputedStyle(n).transform),
  ).not.toBe(first);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  for (const layer of [".overview-fold", ".overview-illumination"])
    expect(
      await page
        .locator(layer)
        .evaluate((n) => getComputedStyle(n).animationPlayState),
    ).toBe("paused");
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".overview-illumination")
      .evaluate((n) => getComputedStyle(n).animationName),
  ).toBe("none");
  expect(
    await page
      .locator(".overview-fold")
      .evaluate((n) => getComputedStyle(n).animationName),
  ).toBe("none");
  await page.getByRole("link", { name: "Открыть каталог сценариев" }).click();
  await expect(page).toHaveURL(/\/scenarios\/catalog/);
});
test("edge peek overlays content, preserves pin state, supports focus and does not change camera", async ({
  page,
}) => {
  await page.goto("/scenarios/radar?q=SYN-&mode=points");
  await page
    .getByRole("button", { name: "Свернуть панель", exact: true })
    .click();
  await expect(
    page.locator(".scenario-subnav, .submenu-toggle, .subnav-compact"),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator(
          ".sidebar .brand-compact, .sidebar .sidebar-toggle, .sidebar .nav-item > svg",
        )
        .evaluateAll((nodes) =>
          Math.max(
            ...nodes.map((n) => {
              const r = n.getBoundingClientRect();
              return Math.abs(r.x + r.width / 2 - 38);
            }),
          ),
        ),
    )
    .toBeLessThanOrEqual(1);
  const rows = await page
    .locator(".sidebar .nav-item > svg")
    .evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return r.y + r.height / 2;
      }),
    );
  rows.slice(1).forEach((y, i) => expect(y - rows[i]).toBeCloseTo(48, 0));
  const main = page.locator(".main-shell");
  const before = (await main.boundingBox())!;
  await page.mouse.move(1, 350);
  await expect(page.locator(".nav-peek")).toBeVisible();
  const after = (await main.boundingBox())!;
  expect(after.x).toBe(before.x);
  expect(after.width).toBe(before.width);
  expect(
    await page.evaluate(() => localStorage.getItem("ctv-nav-collapsed")),
  ).toBe("true");
  await page.mouse.move(120, 350);
  await page.waitForTimeout(300);
  await expect(page.locator(".nav-peek")).toBeVisible();
  await expect(page.locator("#scenario-subnav .subnav-full")).toHaveText([
    "Каталог",
    "Технологический радар",
    "Матрица зрелости",
  ]);
  await page.mouse.move(600, 300);
  await expect(page.locator(".nav-peek")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("q")).toBe("SYN-");
  // Move keyboard focus from the mouse-focused toggle into navigation.
  await page.keyboard.press("Tab");
  await expect(page.locator(".nav-peek")).toBeVisible();
  await page
    .getByRole("button", { name: "Закрепить панель", exact: true })
    .press("Enter");
  await page.mouse.move(700, 300);
  await expect(page.locator(".nav-collapsed")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Свернуть панель", exact: true }),
  ).toBeVisible();
});

test("touch navigation expands manually and compact rail contains only primary destinations", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 768, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(new URL("/overview", baseURL!).href);
  await page
    .getByRole("button", { name: "Свернуть панель", exact: true })
    .tap();
  await expect(page.locator(".scenario-subnav, .submenu-toggle")).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Развернуть панель", exact: true })
    .tap();
  await expect(page.locator("#scenario-subnav")).toBeVisible();
  await page
    .locator("#scenario-subnav")
    .getByRole("link", { name: "Каталог", exact: true })
    .tap();
  await expect(page).toHaveURL(/scenarios\/catalog/);
  await context.close();
});
