import { test, expect } from "@playwright/test";
for (const [width, height] of [
  [768, 900],
  [1366, 768],
  [1440, 900],
  [1920, 1080],
])
  test(`business journeys and layout ${width}`, async ({ page, request }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const noOverflow = async () =>
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    await page.goto("/business");
    await expect(page).toHaveURL(/business\/landscape/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Бизнес-ландшафт",
    );
    await page
      .getByRole("navigation", { name: "Основная навигация" })
      .getByRole("link", { name: "Бизнес и задачи", exact: true })
      .click();
    await expect(page).toHaveURL(/business\/landscape/);
    const structure = page.getByRole("complementary").filter({
      has: page.getByRole("heading", { name: "Структура процессов" }),
    });
    const branch = structure.locator("details").first();
    await branch.locator("summary").first().click();
    await expect(branch).not.toHaveAttribute("open", "");
    await branch.locator("summary").first().click();
    await expect(branch).toHaveAttribute("open", "");
    await structure.getByRole("link").first().click();
    await expect(page).toHaveURL(/process=/);
    const process = new URL(page.url()).searchParams.get("process");
    expect(process).toBeTruthy();
    await expect(
      page.getByRole("navigation", { name: "Иерархия бизнес-процессов" }),
    ).toBeVisible();
    await noOverflow();
    if (width === 1440)
      await page.screenshot({
        path: "output/business/landscape.png",
        fullPage: true,
      });
    const tabs = page.getByRole("navigation", {
      name: "Представления бизнеса и задач",
    });
    await tabs
      .getByRole("link", { name: "Матрица покрытия ЦТ", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`process=${process}`));
    const cell = page
      .locator('[data-coverage-cell]:not([data-level="0"])')
      .first();
    await expect(cell).toBeVisible();
    await cell.click();
    const composition = page.getByRole("region", { name: "Состав ячейки" });
    await expect(composition).toBeVisible();
    expect(await cell.getAttribute("aria-current")).toBe("page");
    await noOverflow();
    if (width === 1440)
      await page.screenshot({
        path: "output/business/coverage.png",
        fullPage: true,
      });
    const cellUrl = page.url();
    const taskLink = composition.locator('a[href*="/business/tasks/"]').first();
    await expect(taskLink).toBeVisible();
    await taskLink.click();
    await expect(page.getByText("Класс задачи", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Связанные сценарии", exact: true }),
    ).toBeVisible();
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await noOverflow();
    if (width === 1440)
      await page.screenshot({
        path: "output/business/task-card.png",
        fullPage: true,
      });
    const before = page.url();
    const popupPromise = page.waitForEvent("popup");
    await page.locator('tbody a[target="_blank"]').first().click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    await expect(popup.locator(".detail-page h1")).toBeVisible();
    expect(page.url()).toBe(before);
    await popup.close();
    await page.getByRole("link", { name: /Вернуться к/ }).click();
    await expect(page).toHaveURL(cellUrl);
    await tabs.getByRole("link", { name: "Классы задач", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`process=${process}`));
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await noOverflow();
    if (width === 1440)
      await page.screenshot({
        path: "output/business/tasks.png",
        fullPage: true,
      });
    await page
      .locator("thead")
      .getByRole("link", { name: /Сценарии ↑|Сценарии ↓|^Сценарии$/ })
      .click();
    await expect(page).toHaveURL(/sort=scenarios/);
    const search = page.getByRole("textbox", { name: "Поиск", exact: true });
    await search.fill("несуществующий класс qzx");
    await page.getByRole("button", { name: "Применить", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "Классы задач не найдены",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Сбросить фильтры", exact: true })
      .click();
    await expect(page).toHaveURL(/business\/tasks$/);
    await expect(
      page.getByRole("textbox", { name: "Поиск", exact: true }),
    ).toHaveValue("");
    await page
      .getByRole("combobox", { name: "Реализация у задач", exact: true })
      .selectOption("yes");
    await page.getByRole("button", { name: "Применить", exact: true }).click();
    await expect(page).toHaveURL(/implementation=yes/);
    await expect(page.locator("tbody tr").first()).toBeVisible();
    for (const row of await page.locator("tbody tr").all()) {
      await expect(row).toContainText("Есть реализация");
      expect(
        Number(await row.locator("td").nth(3).innerText()),
      ).toBeGreaterThan(0);
    }
    await page.goto("/business/coverage?process=invalid");
    await expect(
      page.getByRole("heading", { name: "Некорректные параметры фильтра" }),
    ).toBeVisible();
    // Existing scenario screens are read-only smoke checks, without changing their logic.
    for (const [route, title] of [
      ["catalog", "Каталог сценариев"],
      ["radar", "Технологический радар"],
      ["maturity", "Матрица зрелости"],
    ]) {
      const r = await request.get(`/scenarios/${route}`);
      expect(r.ok()).toBe(true);
      expect(await r.text()).toContain(title);
    }
    expect(errors).toEqual([]);
  });
