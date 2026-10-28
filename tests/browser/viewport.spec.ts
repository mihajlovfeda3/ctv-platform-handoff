import { test, expect } from "@playwright/test";
test("outer viewport bounds at 1/3/8x, contextual labels and no camera fetches", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404"))
      errors.push(m.text());
  });
  await page.goto("/scenarios/radar?q=SYN-&mode=points");
  await expect(page.locator(".shared-filters")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const svg = page.locator(".interactive-radar");
  await svg.scrollIntoViewIfNeeded();
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("_rsc") || r.url().includes("/api/scenarios"))
      requests.push(r.url());
  });
  const initialRequests = requests.length;
  const dimensions = await svg.evaluate((node) => {
    const svg = node as SVGSVGElement,
      r = svg.getBoundingClientRect();
    return {
      w: r.width,
      h: r.height,
      vw: svg.viewBox.baseVal.width,
      vh: svg.viewBox.baseVal.height,
    };
  });
  expect(dimensions.vw).toBeCloseTo(dimensions.w, 1);
  expect(dimensions.vh).toBeCloseTo(dimensions.h, 1);
  async function capture(path: string) {
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.screenshot({ path, fullPage: true });
  }

  for (const scale of ["1", "3", "8"]) {
    await page.getByLabel("Установить масштаб").selectOption(scale);
    await svg.scrollIntoViewIfNeeded();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
    ]) {
      for (let i = 0; i < 4; i++) {
        const b = (await svg.boundingBox())!;
        const start = {
          x: dx < 0 ? b.x + b.width - 2 : b.x + 2,
          y: dy < 0 ? b.y + b.height - 2 : b.y + 2,
        };
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(
          start.x + dx * (b.width - 4),
          start.y + dy * (b.height - 4),
          { steps: 4 },
        );
        await page.mouse.up();
      }
      const geom = await page
        .locator("[data-testid=camera]")
        .evaluate((node) => {
          const s = (node as SVGElement).ownerSVGElement!,
            b = s.getBoundingClientRect();
          return {
            x: Number(node.getAttribute("data-pan-x")),
            y: Number(node.getAttribute("data-pan-y")),
            r: Number(node.getAttribute("data-radius")),
            w: b.width,
            h: b.height,
          };
        });
      expect(
        Math.hypot(geom.x, geom.y) + Math.min(geom.w, geom.h) * 0.28,
      ).toBeLessThanOrEqual(geom.r + 0.1);
      await expect(page.locator(".direction-label").first()).toBeVisible();
      const overlap = await page.locator(".radar-viewport").evaluate((node) => {
        const labels = [...node.querySelectorAll(".direction-label")].map((n) =>
          n.getBoundingClientRect(),
        );
        const tool = node
          .querySelector(".radar-tools")!
          .getBoundingClientRect();
        const boxes = [...labels, tool];
        return boxes.some((a, i) =>
          boxes.some(
            (b, j) =>
              j > i &&
              a.left < b.right &&
              a.right > b.left &&
              a.top < b.bottom &&
              a.bottom > b.top,
          ),
        );
      });
      expect(overlap).toBe(false);
      await expect(
        page.getByText("Данные временно недоступны", { exact: true }),
      ).toHaveCount(0);
    }
  }
  expect(requests.length).toBe(initialRequests);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Сброс масштаба" }).click();
  if (process.env.SAVE_UX_SCREENSHOTS && info.project.name !== "768") {
    await capture(
      `docs/screenshots/2b-correction/radar-${info.project.name}.jpg`,
    );
    await page.getByLabel("Установить масштаб").selectOption("3");
    await capture(
      `docs/screenshots/2b-correction/radar-3x-${info.project.name}.jpg`,
    );
    const b = (await svg.boundingBox())!;
    for (let i = 0; i < 4; i++) {
      await page.mouse.move(b.x + 2, b.y + 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width - 2, b.y + 2, { steps: 3 });
      await page.mouse.up();
    }
    await capture(
      `docs/screenshots/2b-correction/radar-limit-${info.project.name}.jpg`,
    );
  }
  await page.getByRole("button", { name: "Сброс масштаба" }).click();
  await page.locator("circle[data-scenario]").first().press("Enter");
  await expect(
    page.getByRole("region", { name: "Быстрый просмотр сценария" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("q")).toBe("SYN-");
  await page.getByLabel("Установить масштаб").selectOption("3");
  const controlOverlap = await page.locator(".radar-tools").evaluate((node) => {
    const a = node.getBoundingClientRect(),
      b = document
        .querySelector(".scenario-inspector")!
        .getBoundingClientRect();
    return (
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top
    );
  });
  expect(controlOverlap).toBe(false);
  await page.getByRole("link", { name: "Открыть полную карточку →" }).click();
  await expect(page).toHaveURL(/from=radar/);
  expect(new URL(page.url()).searchParams.get("zoom")).toBe("3");
  await page.getByRole("link", { name: "← Вернуться к выборке" }).click();
  await expect(page).toHaveURL(/\/scenarios\/radar\?/);
  expect(new URL(page.url()).searchParams.get("zoom")).toBe("3");
  await page
    .locator("#scenario-subnav")
    .getByRole("link", { name: "Матрица зрелости" })
    .click();
  await expect(page.locator(".matrix-scatter")).toBeVisible();
  const bad = await page
    .locator(".matrix-point")
    .evaluateAll((nodes) =>
      nodes.some(
        (n) =>
          Math.round((Number(n.getAttribute("cx")) - 80) / 100) !==
            Number(n.getAttribute("data-readiness")) ||
          Math.round((570 - Number(n.getAttribute("cy"))) / 95) !==
            Number(n.getAttribute("data-maturity")),
      ),
    );
  expect(bad).toBe(false);
  await page.keyboard.press("Escape");
  if (process.env.SAVE_UX_SCREENSHOTS && info.project.name !== "768")
    await capture(
      `docs/screenshots/2b-correction/matrix-${info.project.name}.jpg`,
    );
});
