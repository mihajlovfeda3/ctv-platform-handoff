import { test, expect } from "@playwright/test";
for (const [width, height] of [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
])
  test(`cube inspector and fullscreen ${width}`, async ({ page, request }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const noOverflow = async () =>
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
    await page.setViewportSize({ width, height });
    if (width === 1366)
      await page.addInitScript(() => {
        Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
          value: undefined,
          configurable: true,
        });
      });
    const data = await (
      await request.get("/api/scenarios/analytics?context=synthetic-lab")
    ).json();
    const row = data.rows.find(
      (r: { maturity: number | null; readiness: number | null }) =>
        r.maturity !== null && r.readiness !== null,
    );
    await page.goto(
      `/scenarios/cube?context=synthetic-lab&implementation=${row.implementation}&selected=${row.id}`,
    );
    const canvas = page.getByLabel("Интерактивный куб сценариев");
    await expect(canvas).toHaveAttribute("data-camera", /.+/);
    const inspector = page.getByRole("complementary", {
      name: "Быстрый просмотр сценария",
    });
    await expect(inspector).toContainText(row.name);
    await expect(inspector).not.toContainText("Загрузка описания…");
    await noOverflow();
    const size = await canvas.boundingBox();
    const camera = await canvas.getAttribute("data-camera");
    await page.getByText("Направления", { exact: true }).click();
    await page
      .getByRole("button", {
        name: new RegExp(
          row.directions[0].name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        ),
      })
      .last()
      .click();
    const unfold = page.getByRole("region", { name: "Развёртка направления" });
    await expect(unfold).toBeVisible();
    const a = (await inspector.boundingBox())!,
      b = (await unfold.boundingBox())!;
    expect(a.x + a.width).toBeLessThan(b.x);
    expect((await canvas.boundingBox())!.width).toBe(size!.width);
    if (width === 1440)
      await page.screenshot({ path: "output/cube/shell-normal.png" });
    await page
      .getByRole("button", { name: "Полноэкранный режим", exact: true })
      .click();
    await expect(page.locator('[data-fullscreen="true"]')).toBeVisible();
    await expect(canvas).toHaveAttribute("data-camera", camera!);
    expect((await canvas.boundingBox())!.width).toBeGreaterThan(width - 40);
    await expect(inspector).toBeVisible();
    await noOverflow();
    for (const name of ["Сброс камеры", "Выйти из полноэкранного режима"]) {
      const rect = (await page
        .getByRole("button", { name, exact: true })
        .boundingBox())!;
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y + rect.height).toBeLessThanOrEqual(height);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width);
    }
    const area = (await canvas.boundingBox())!;
    await page.mouse.move(area.x + area.width / 2, area.y + 100);
    await page.mouse.down();
    await page.mouse.move(area.x + area.width / 2 + 45, area.y + 125, {
      steps: 8,
    });
    await page.mouse.up();
    await expect(canvas).not.toHaveAttribute("data-camera", camera!);
    if (width === 1440)
      await page.screenshot({ path: "output/cube/shell-fullscreen.png" });
    await canvas.hover({
      position: { x: (await canvas.boundingBox())!.width / 2, y: 100 },
    });
    await page.mouse.wheel(0, -180);
    await expect(canvas).not.toHaveAttribute("data-camera", camera!);
    await page
      .getByRole("button", { name: "Сброс камеры", exact: true })
      .click();
    await expect(canvas).toHaveAttribute("data-camera", camera!);
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-fullscreen="false"]')).toBeVisible();
    await expect(canvas).toHaveAttribute("data-selected", row.id);
    await page
      .getByRole("button", { name: "Полноэкранный режим", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Выйти из полноэкранного режима" })
      .click();
    await expect(page.locator('[data-fullscreen="false"]')).toBeVisible();
    const full = inspector.getByRole("link", {
      name: "Открыть полную карточку",
    });
    await full.click();
    await expect(page).toHaveURL(new RegExp(`/scenarios/${row.id}\\?`));
    await page.goBack();
    await expect(inspector).toContainText(row.name);
    await page.getByRole("button", { name: "Закрыть инспектор" }).click();
    await expect(inspector).toHaveCount(0);
    await expect(page).not.toHaveURL(/selected=/);
    await expect(canvas).toHaveAttribute("data-selected", "");
    await noOverflow();
    expect(errors).toEqual([]);
  });

test("cube top spacing matches maturity", async ({ page }) => {
  for (const width of [1366, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/scenarios/maturity");
    await expect(
      page.getByRole("heading", { name: "Матрица зрелости", exact: true }),
    ).toBeVisible();
    const measure = () =>
      page.evaluate(() => {
        const bar = document.querySelector(".topbar")!.getBoundingClientRect();
        const title = [...document.querySelectorAll("h1")]
          .find((el) => el.getBoundingClientRect().height > 0)!
          .getBoundingClientRect();
        return {
          height: bar.height,
          inset: title.top - bar.bottom,
          breadcrumbInset:
            document.querySelector(".breadcrumb")!.getBoundingClientRect()
              .left - bar.left,
        };
      });
    const expected = await measure();
    await page.goto("/scenarios/cube");
    await expect(
      page.getByRole("heading", {
        name: "Куб технологических сценариев",
        exact: true,
      }),
    ).toBeVisible();
    expect(await measure()).toEqual(expected);
  }
});
