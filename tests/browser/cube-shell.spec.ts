import { test, expect } from "@playwright/test";
for (const [width, height] of [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
])
  test(`cube inspector and fullscreen ${width}`, async ({ page, request }) => {
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
    if (width === 1440)
      await page.screenshot({ path: "output/cube/shell-fullscreen.png" });
    await page
      .getByRole("button", { name: "Приблизить куб", exact: true })
      .click();
    await expect(canvas).not.toHaveAttribute("data-camera", camera!);
    await page
      .getByRole("button", { name: "Сброс камеры", exact: true })
      .click();
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
  });
