import { test, expect } from "@playwright/test";
import { PerspectiveCamera, Vector3 } from "three";
import { cubePosition } from "../../src/domain/cube-geometry";
import { demoId } from "../../src/domain/ctv-reference";

for (const [width, height] of [
  [1440, 900],
  [1920, 1080],
])
  test(`cube interaction and resize at ${width}`, async ({ page, request }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/scenarios/cube");
    await expect(
      page.getByLabel("Интерактивный куб сценариев"),
    ).toHaveAttribute("data-camera", /.+/);
    const canvas = page.getByLabel("Интерактивный куб сценариев");
    await expect(canvas).toHaveAttribute("data-camera", /,/);
    async function labelsDoNotOverlap() {
      const boxes = await page
        .locator(
          'button[aria-label^="Вершина "], [data-maturity-level], [data-readiness-level]',
        )
        .evaluateAll((elements) =>
          elements
            .filter((el) => getComputedStyle(el).display !== "none")
            .map((el) => {
              const r = el.getBoundingClientRect();
              return {
                x: r.x,
                y: r.y,
                w: r.width,
                h: r.height,
                text: el.textContent,
              };
            }),
        );
      expect(boxes.length).toBeGreaterThan(0);
      for (const a of boxes) {
        expect(a.text).toMatch(/[А-Яа-я]/);
        for (const b of boxes.filter((b) => b !== a))
          expect(
            a.x >= b.x + b.w ||
              b.x >= a.x + a.w ||
              a.y >= b.y + b.h ||
              b.y >= a.y + a.h,
          ).toBe(true);
      }
    }
    await labelsDoNotOverlap();
    await expect(page.locator("[data-readiness-level]:visible")).toHaveCount(0);
    const initial = await canvas.getAttribute("data-camera"),
      box = (await canvas.boundingBox())!;
    expect(box.width).toBeGreaterThan(width - 300);
    expect(box.height).toBeGreaterThanOrEqual(height - 260);
    await expect(
      page
        .locator("details")
        .filter({ has: page.getByText("Направления", { exact: true }) }),
    ).not.toHaveAttribute("open", "");
    const directionMenu = page
      .locator("details")
      .filter({ has: page.getByText("Направления", { exact: true }) });
    await directionMenu.locator("summary").click();
    await expect(directionMenu.getByRole("button")).toHaveCount(8);
    await directionMenu.locator("summary").click();
    console.info(
      JSON.stringify({
        viewport: `${width}x${height}`,
        sceneWidth: box.width,
        sceneHeight: box.height,
      }),
    );
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
    await expect(canvas).toHaveAttribute("data-projection-scenario", /.+/);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('[aria-live="polite"] strong')).toBeVisible();
    await labelsDoNotOverlap();
    const pickedId = await canvas.getAttribute("data-selected");
    const picked = data.rows.find(
      (entry: { id: string }) => entry.id === pickedId,
    );
    const panel = page.locator('[aria-live="polite"]');
    await expect(panel).toContainText(`РЗ${picked.maturity}/5`);
    await expect(panel).toContainText(`ОГ${picked.readiness}/7`);
    await expect(panel).toContainText(`Влияние${picked.impact}/3`);
    await page
      .getByRole("button", { name: "Сброс камеры", exact: true })
      .hover();
    if (width === 1440)
      await page.screenshot({
        path: "output/cube/space-overview.png",
        fullPage: false,
      });
    const pickedDirection = Array.from({ length: 8 }, (_, i) =>
      demoId(`direction:${i}`),
    ).findIndex((id) =>
      picked.directions.some((d: { id: string }) => d.id === id),
    );
    const vertex = page.getByRole("button", {
      name: new RegExp(`^Вершина ${pickedDirection + 1}:`),
    });
    await vertex.hover();
    await expect(canvas).toHaveAttribute(
      "data-highlighted-direction",
      String(pickedDirection),
    );
    const beforeFocus = await canvas.getAttribute("data-camera");
    await vertex.click();
    await expect(vertex).toHaveAttribute("aria-pressed", "true");
    const unfold = page.getByRole("region", { name: "Развёртка направления" });
    await expect(unfold).toBeVisible();
    await expect(canvas).toHaveAttribute("data-camera", beforeFocus!);
    await expect(canvas).toHaveAttribute("data-selected", pickedId!);
    for (let readiness = 1; readiness <= 7; readiness++)
      await expect(
        page.locator(`[data-readiness-level="${readiness}"]`),
      ).toBeVisible();
    await expect(canvas).toHaveAttribute(
      "data-guide-readiness",
      String(picked.readiness),
    );
    await expect(canvas).toHaveAttribute(
      "data-guide-maturity",
      String(picked.maturity),
    );
    await expect(
      page.locator(`[data-readiness-level="${picked.readiness}"]`),
    ).toHaveAttribute("data-active", "true");
    await expect(
      page.locator(`[data-maturity-level="${picked.maturity}"]`),
    ).toHaveAttribute("data-active", "true");
    await expect(
      page.locator(`[data-maturity-level="${picked.maturity}"]`),
    ).toBeVisible();
    await labelsDoNotOverlap();
    const directionId = demoId(`direction:${pickedDirection}`);
    const relevant = data.rows.filter((r: { directions: { id: string }[] }) =>
      r.directions.some((d) => d.id === directionId),
    );
    const plottable = relevant.filter(
      (r: {
        maturity: number | null;
        readiness: number | null;
        implementation: string;
      }) =>
        r.maturity !== null &&
        r.readiness !== null &&
        ["yes", "no"].includes(r.implementation),
    );
    await expect(unfold.locator("[data-focus-scenario]")).toHaveCount(
      plottable.length,
    );
    const missing = relevant.filter(
      (r: { maturity: number | null; readiness: number | null }) =>
        r.maturity === null || r.readiness === null,
    );
    await expect(unfold).toContainText(`Без РЗ или ОГ: ${missing.length}`);
    for (const r of relevant.filter(
      (r: { maturity: number | null; readiness: number | null }) =>
        r.maturity === null || r.readiness === null,
    ))
      await expect(
        unfold.locator(`[data-focus-scenario="${r.id}"]`),
      ).toHaveCount(0);
    await expect(unfold.getByLabel("РЗ по X, ОГ по Y")).toBeVisible();
    await expect(
      unfold.locator(`[data-focus-scenario="${pickedId}"]`),
    ).toHaveAttribute("aria-pressed", "true");
    const next =
      plottable.find((r: { id: string }) => r.id !== pickedId) ?? plottable[0];
    const marker = unfold.locator(`[data-focus-scenario="${next.id}"]`);
    await marker.hover();
    await expect(canvas).toHaveAttribute(
      "data-guide-readiness",
      String(next.readiness),
    );
    await expect(canvas).toHaveAttribute(
      "data-guide-maturity",
      String(next.maturity),
    );
    await expect(page.getByRole("tooltip")).toContainText(next.name);
    await expect(marker).toHaveAttribute(
      "data-maturity",
      String(next.maturity),
    );
    await expect(marker).toHaveAttribute(
      "data-readiness",
      String(next.readiness),
    );
    await expect(marker).toHaveAttribute(
      "fill",
      next.implementation === "yes" ? "#2274c5" : "#ec963b",
    );
    await marker.click();
    await expect(canvas).toHaveAttribute("data-selected", next.id);
    await expect(canvas).toHaveAttribute("data-camera", beforeFocus!);
    await expect(panel).toContainText(next.name);
    await expect(marker).toHaveAttribute("aria-pressed", "true");
    // Clicking the visible 3D point must update the same 2D selection.
    await page.mouse.move(
      box.x + ((p.x + 1) * box.width) / 2,
      box.y + ((1 - p.y) * box.height) / 2,
    );
    await page.mouse.down();
    await page.mouse.up();
    const pickedAgain = await canvas.getAttribute("data-selected");
    await expect(
      unfold.locator(`[data-focus-scenario="${pickedAgain}"]`),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(canvas).toHaveAttribute("data-camera", beforeFocus!);
    if (width === 1440) {
      await page
        .getByRole("button", { name: "Сброс камеры", exact: true })
        .hover();
      await page.screenshot({
        path: "output/cube/readiness-focus.png",
        fullPage: false,
      });
    }
    await page
      .getByRole("button", { name: "Приблизить куб", exact: true })
      .click();
    await expect(canvas).not.toHaveAttribute("data-camera", beforeFocus!);
    const beforeExit = await canvas.getAttribute("data-camera");
    await page
      .getByRole("button", { name: "Общий обзор", exact: true })
      .click();
    await expect(unfold).toHaveCount(0);
    await expect(page.locator("[data-readiness-level]:visible")).toHaveCount(0);
    await expect(canvas).toHaveAttribute("data-camera", beforeExit!);
    await expect(canvas).toHaveAttribute("data-selected", pickedAgain!);
    await directionMenu.locator("summary").click();
    await directionMenu.getByRole("button").nth(pickedDirection).click();
    await expect(unfold).toBeVisible();
    await expect(canvas).toHaveAttribute("data-camera", beforeExit!);
    await page
      .getByRole("button", { name: "Сброс камеры", exact: true })
      .click();
    await expect(canvas).toHaveAttribute("data-camera", initial!);
    await expect(canvas).toHaveAttribute("data-selected", pickedAgain!);
    const guideReadiness = await canvas.getAttribute("data-guide-readiness"),
      guideMaturity = await canvas.getAttribute("data-guide-maturity");
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.6, {
      steps: 10,
    });
    await page.mouse.up();
    await expect(canvas).not.toHaveAttribute("data-camera", initial!);
    await expect(canvas).toHaveAttribute(
      "data-guide-readiness",
      guideReadiness!,
    );
    await expect(canvas).toHaveAttribute("data-guide-maturity", guideMaturity!);
    await labelsDoNotOverlap();
    await page
      .getByRole("button", { name: "Общий обзор", exact: true })
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
    await page.getByText(/^Сценарии в кубе/).click();
    const listChoice = page
      .locator("details")
      .getByRole("button", { name: /SYN-/ })
      .last();
    const chosenText = await listChoice.textContent();
    await listChoice.click();
    await expect(page.locator('[aria-live="polite"]')).toContainText(
      chosenText!.split(" · ")[0],
    );
    await expect(canvas).toHaveAttribute("data-selected", /.+/);
    await page
      .getByRole("button", { name: "Сброс камеры", exact: true })
      .click();
    for (let step = 0; step < 15; step++)
      await page
        .getByRole("button", { name: "Приблизить куб", exact: true })
        .click();
    await expect
      .poll(async () =>
        Math.max(
          ...(await canvas.getAttribute("data-camera"))!
            .split(",")
            .map((v) => Math.abs(Number(v))),
        ),
      )
      .toBeLessThan(1);
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-distance")))
      .toBeGreaterThanOrEqual(0.18);
    await page
      .getByRole("button", { name: "Отдалить куб", exact: true })
      .click();
    const closeDistance = Number(await canvas.getAttribute("data-distance"));
    const zoomBox = (await canvas.boundingBox())!;
    await page.mouse.move(
      zoomBox.x + zoomBox.width / 2,
      zoomBox.y + zoomBox.height / 2,
    );
    await page.mouse.wheel(0, 250);
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-distance")))
      .toBeGreaterThan(closeDistance);
    await page
      .getByRole("button", { name: "Сброс камеры", exact: true })
      .click();
    await expect(canvas).toHaveAttribute("data-camera", initial!);
    await labelsDoNotOverlap();
    await page.screenshot({ path: `output/cube/refined-${width}.png` });
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
  await page.goto("/scenarios/cube");
  await expect(page.getByRole("status")).toContainText("WebGL недоступен");
  await expect(
    page.getByText("Куб технологических сценариев", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /SYN-/ }).first().click();
  await expect(page.locator('[aria-live="polite"] strong')).toBeVisible();
});
