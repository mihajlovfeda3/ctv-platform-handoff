import { test, expect } from "@playwright/test";

for (const [width, height] of [
  [1440, 900],
  [1920, 1080],
])
  test(`cube shares navigation, URL selection and filters at ${width}`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const data = await (
      await request.get("/api/scenarios/analytics?q=SYN-&implementation=yes")
    ).json();
    const row = data.rows.find(
      (r: { maturity: number | null; readiness: number | null }) =>
        r.maturity !== null && r.readiness !== null,
    );
    const query = new URLSearchParams({
      q: "SYN-",
      implementation: "yes",
      readinessMin: "1",
      selected: row.id,
      context: "synthetic-lab",
    });
    await page.goto(`/scenarios/catalog?${query}`);
    const tabs = page.getByRole("navigation", {
      name: "Представления сценариев",
    });
    await expect(tabs.getByRole("link")).toHaveCount(4);
    await tabs.getByRole("link", { name: "3D-куб", exact: true }).click();
    await expect(page).toHaveURL(/\/scenarios\/cube\?/);
    await expect(page.locator(".breadcrumb")).toContainText("3D-куб");
    await expect(
      page.getByLabel("Интерактивный куб сценариев"),
    ).toHaveAttribute("data-camera", /.+/);
    const canvas = page.getByLabel("Интерактивный куб сценариев");
    await expect(canvas).toHaveAttribute("data-selected", row.id);
    const box = (await canvas.boundingBox())!;
    expect(box.width).toBeGreaterThan(width - 300);
    expect(box.height).toBeGreaterThan(height - 260);
    const camera = await canvas.getAttribute("data-camera");
    await page.getByText(/^Сценарии в кубе/).click();
    const choice = page
      .locator("details")
      .getByRole("button", { name: /SYN-/ })
      .last();
    const external = (await choice.innerText()).split(" · ")[0];
    const selected = data.rows.find(
      (r: { externalId: string }) => r.externalId === external,
    );
    await choice.click();
    await expect(page).toHaveURL(new RegExp(`selected=${selected.id}`));
    await expect(canvas).toHaveAttribute("data-selected", selected.id);
    await expect(canvas).toHaveAttribute("data-camera", camera!);
    await expect(page.locator('[aria-live="polite"]')).toContainText(
      selected.name,
    );
    for (const name of [
      "Каталог",
      "Технологический радар",
      "Матрица зрелости",
    ]) {
      await expect(
        tabs.getByRole("link", { name, exact: true }),
      ).toHaveAttribute("href", new RegExp(`selected=${selected.id}`));
      await tabs.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`selected=${selected.id}`));
      const url = new URL(page.url());
      expect(url.searchParams.get("implementation")).toBe("yes");
      expect(url.searchParams.get("readinessMin")).toBe("1");
      await expect(
        page.getByRole("region", {
          name: "Быстрый просмотр сценария",
          exact: true,
        }),
      ).toContainText(selected.name);
    }
    await tabs.getByRole("link", { name: "3D-куб", exact: true }).click();
    await expect(
      page.getByLabel("Интерактивный куб сценариев"),
    ).toHaveAttribute("data-camera", /.+/);
    await expect(canvas).toHaveAttribute("data-selected", selected.id);
    const filters = page.locator("details").filter({
      has: page.locator('form[aria-label="Общие фильтры сценариев"]'),
    });
    await filters.locator("summary").first().click();
    await filters.locator('input[name="q"]').fill(selected.externalId);
    await expect
      .poll(() => new URL(page.url()).searchParams.get("q"))
      .toBe(selected.externalId);
    await expect(page).toHaveURL(new RegExp(`selected=${selected.id}`));
    await expect(
      page.getByText("Фильтры сценариев · 1", { exact: true }),
    ).toBeVisible();
    await expect(canvas).toHaveAttribute("data-selected", selected.id);
    await filters.locator("summary").first().click();
    const directionMenu = page
      .locator("details")
      .filter({ has: page.getByText("Направления", { exact: true }) });
    await directionMenu.locator("summary").click();
    await directionMenu.getByRole("button").first().click();
    await expect(
      page.getByRole("region", { name: "Развёртка направления" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Общий обзор", exact: true })
      .click();
    await canvas.hover({
      position: { x: (await canvas.boundingBox())!.width / 2, y: 100 },
    });
    await page.mouse.wheel(0, -180);
    await page
      .getByRole("button", { name: "Сброс камеры", exact: true })
      .click();
    await expect(canvas).toHaveAttribute("data-selected", selected.id);
    if (width === 1440)
      await page.screenshot({
        path: "output/cube/integrated-cube.png",
        fullPage: true,
      });
    expect(errors).toEqual([]);
  });

test("integrated cube handles no WebGL and invalid URL", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      return type.includes("webgl")
        ? null
        : Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/scenarios/cube");
  await expect(page.getByRole("status")).toContainText("WebGL недоступен");
  await expect(
    page
      .getByRole("navigation", { name: "Представления сценариев" })
      .getByRole("link"),
  ).toHaveCount(4);
  await page.goto("/scenarios/cube?maturity=6");
  await expect(
    page.getByRole("heading", { name: "Некорректные параметры фильтра" }),
  ).toBeVisible();
});
