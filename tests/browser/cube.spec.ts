import { test, expect } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { cubePosition } from "../../src/domain/cube-geometry";
import { demoId } from "../../src/domain/ctv-reference";

for (const [width, height] of [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
])
  test(`cube interaction and resize at ${width}`, async ({ page, request }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/experiments/cube");
    await expect(page.getByRole("status")).toContainText("Сцена готова");
    const canvas = page.getByLabel("Интерактивный куб сценариев");
    await expect(canvas).toHaveAttribute("data-camera", /,/);
    const initial = await canvas.getAttribute("data-camera"),
      box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.6, {
      steps: 12,
    });
    await page.mouse.up();
    await expect(canvas).not.toHaveAttribute("data-camera", initial!);
    await page
      .getByRole("button", { name: "Сброс камеры", exact: true })
      .click();
    await expect(canvas).toHaveAttribute("data-camera", initial!);
    await page
      .getByRole("button", { name: "Приблизить куб", exact: true })
      .click();
    await expect(canvas).not.toHaveAttribute("data-camera", initial!);
    await page
      .getByRole("button", { name: "Сброс камеры", exact: true })
      .click();
    await expect(canvas).toHaveAttribute("data-camera", initial!);
    const data = await (
      await request.get("/api/scenarios/analytics?q=SYN-")
    ).json();
    const row = data.rows.find(
      (r: {
        maturity: number | null;
        readiness: number | null;
        directions: { id: string }[];
      }) =>
        r.maturity &&
        r.readiness &&
        r.directions.some((d) =>
          Array.from({ length: 8 }, (_, i) =>
            demoId(`direction:${i}`),
          ).includes(d.id),
        ),
    );
    const index = Array.from({ length: 8 }, (_, i) =>
      demoId(`direction:${i}`),
    ).findIndex((id) =>
      row.directions.some((d: { id: string }) => d.id === id),
    );
    const camera = new PerspectiveCamera(40, box.width / box.height, 0.1, 40);
    camera.position.set(3.5, 2.7, 4.2);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const p = new Vector3(
      ...cubePosition(index, row.maturity, row.readiness),
    ).project(camera);
    await page.mouse.move(
      box.x + ((p.x + 1) * box.width) / 2,
      box.y + ((1 - p.y) * box.height) / 2,
    );
    await expect(page.getByRole("tooltip")).toContainText("SYN-");
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('[aria-live="polite"] strong')).toBeVisible();
    const vertex = page.getByRole("button", { name: /^Вершина 1:/ });
    await vertex.hover();
    await vertex.click();
    await expect(vertex).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "Фокус направления", exact: true })
      .click();
    await expect(canvas).not.toHaveAttribute("data-camera", initial!);
    if (width === 1440)
      await page.screenshot({ path: "output/cube/cube-focus.png" });
    await page
      .getByRole("button", { name: "Все направления", exact: true })
      .click();
    await page.setViewportSize({ width: width - 180, height: height - 80 });
    await expect
      .poll(() =>
        canvas.evaluate((el) =>
          Math.abs(
            (el as HTMLCanvasElement).width / window.devicePixelRatio -
              el.clientWidth,
          ),
        ),
      )
      .toBeLessThan(2);
    if (width === 1440) {
      await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width * 0.65,
        box.y + box.height * 0.55,
        { steps: 12 },
      );
      await page.mouse.up();
      await page.screenshot({ path: "output/cube/cube-orbit.png" });
    }
    expect(errors).toEqual([]);
  });
test("cube without WebGL retains accessible data", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type.includes("webgl")) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/experiments/cube");
  await expect(page.getByRole("status")).toContainText("WebGL недоступен");
  await expect(
    page.getByText("Куб технологических сценариев", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /SYN-/ }).first().click();
  await expect(page.locator('[aria-live="polite"] strong')).toBeVisible();
});
