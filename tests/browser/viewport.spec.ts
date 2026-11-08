import { test, expect } from "@playwright/test";
import { contextualSectors } from "../../src/domain/radar-labels";

// Hundreds of real pointer moves plus card/matrix navigation run in this test.
// Keep assertion timeouts strict; allow the complete gesture journey on busy CI hosts.
test.setTimeout(90000);

test("outer viewport bounds at 1/3/8x, contextual labels and no camera fetches", async ({
  page,
  browser,
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
    const url = new URL(r.url());
    // Unrelated navigation prefetch (e.g. Overview) is not an analytics reload.
    if (
      (url.pathname.startsWith("/scenarios/") &&
        url.searchParams.has("_rsc")) ||
      url.pathname.startsWith("/api/scenarios")
    )
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
    await page.mouse.move(200, 10);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.getSelection()?.removeAllRanges();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.screenshot({ path, fullPage: true });
  }

  async function setZoom(scale: number) {
    await svg.evaluate((node, target) => {
      const current = Number(
        node.querySelector("[data-testid=camera]")!.getAttribute("data-zoom"),
      );
      const b = node.getBoundingClientRect();
      node.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: Math.log(current / target) / 0.002,
          clientX: b.left + b.width / 2,
          clientY: b.top + b.height / 2,
          bubbles: true,
          cancelable: true,
        }),
      );
    }, scale);
    await expect
      .poll(async () =>
        Number(
          await page.locator("[data-testid=camera]").getAttribute("data-zoom"),
        ),
      )
      .toBeCloseTo(scale, 5);
  }
  if (info.project.name === "768")
    await expect
      .poll(() => page.locator(".direction-label").count())
      .toBeGreaterThanOrEqual(4);
  else await expect(page.locator(".direction-label")).toHaveCount(8);
  await expect(
    page.locator(".radar-tools select, .radar-tools output"),
  ).toHaveCount(0);
  await expect(page.getByLabel("Приблизить", { exact: true })).toBeHidden();
  await expect(page.locator(".selection-count, .topbar-right")).toHaveCount(0);
  await expect(
    page.getByText("Исследуйте технологии в контексте бизнес-задач"),
  ).toHaveCount(0);
  await expect(page.locator(".analytics-legend")).not.toContainText("Без ОГ");
  await page.getByRole("button", { name: "О диаграмме и выборке" }).click();
  await expect(page.locator(".radar-info-popover")).toContainText(
    "синтетические",
  );
  await page.keyboard.press("Escape");
  await page.locator(".direction-label").first().hover();
  await expect(
    page.locator(".radar-sector[data-highlighted=true]"),
  ).toHaveCount(1);
  await svg.focus();
  await page.keyboard.press("+");
  await expect(page).toHaveURL(/zoom=1.25/);
  await page.keyboard.press("0");
  const marker = (await page
    .locator("circle[data-scenario]")
    .first()
    .boundingBox())!;
  await page.mouse.move(
    marker.x + marker.width / 2,
    marker.y + marker.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    marker.x + marker.width / 2 + 40,
    marker.y + marker.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect
    .poll(async () =>
      Number(
        await page.locator("[data-testid=camera]").getAttribute("data-pan-x"),
      ),
    )
    .toBeCloseTo(40);
  expect(new URL(page.url()).searchParams.has("selected")).toBe(false);
  await svg.focus();
  await page.keyboard.press("0");
  for (const scale of [1, 3, 8]) {
    await setZoom(scale);
    await svg.scrollIntoViewIfNeeded();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
    ]) {
      for (let i = 0; i < (scale === 8 ? 6 : 4); i++) {
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
      expect(
        Math.hypot(geom.x, geom.y) + Math.min(geom.w, geom.h) * 0.28,
      ).toBeGreaterThanOrEqual(geom.r - 0.1);
      await expect(page.locator(".direction-label").first()).toBeVisible();
      const overlap = await page.locator(".radar-viewport").evaluate((node) => {
        const labels = [...node.querySelectorAll(".direction-label")].map((n) =>
          n.getBoundingClientRect(),
        );
        const tool = node
          .querySelector(".radar-tools")!
          .getBoundingClientRect();
        const boxes = [...labels, tool].filter(
          (b) => b.width > 0 && b.height > 0,
        );
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
      const expected = contextualSectors(
        { z: scale, x: geom.x, y: geom.y },
        { width: geom.w, height: geom.h },
        8,
      )
        .map((s) => String(s.index))
        .sort();
      const shown = await page
        .locator(".direction-label")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getAttribute("data-sector")),
        );
      expect(expected).toEqual(expect.arrayContaining(shown));
      await expect(page.locator(".direction-leaders line")).toHaveCount(
        shown.length,
      );
      await expect(
        page.getByText("Данные временно недоступны", { exact: true }),
      ).toHaveCount(0);
    }
  }
  if (info.project.name === "768") {
    await svg.focus();
    await page.keyboard.press("0");
    await setZoom(8);
    await svg.scrollIntoViewIfNeeded();
    const b = (await svg.boundingBox())!;
    for (let i = 0; i < 6; i++) {
      await page.mouse.move(b.x + b.width - 2, b.y + b.height - 2);
      await page.mouse.down();
      await page.mouse.move(
        b.x + b.width - 2 - 400,
        b.y + b.height - 2 - 400 * Math.tan(Math.PI / 8),
        { steps: 4 },
      );
      await page.mouse.up();
    }
    await expect(page.locator(".direction-label")).toHaveCount(1);
  }
  expect(requests.length).toBe(initialRequests);
  expect(errors).toEqual([]);
  await svg.focus();
  await page.keyboard.press("0");
  if (process.env.SAVE_UX_SCREENSHOTS && info.project.name !== "768") {
    await capture(
      `docs/screenshots/2b-final-ux/radar-${info.project.name}.jpg`,
    );
    await setZoom(3);
    await capture(
      `docs/screenshots/2b-final-ux/radar-3x-${info.project.name}.jpg`,
    );
    const b = (await svg.boundingBox())!;
    for (let i = 0; i < 4; i++) {
      await page.mouse.move(b.x + 2, b.y + 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width - 2, b.y + 2, { steps: 3 });
      await page.mouse.up();
    }
    await capture(
      `docs/screenshots/2b-final-ux/radar-limit-${info.project.name}.jpg`,
    );
  }
  if (process.env.SAVE_UX_SCREENSHOTS && info.project.name !== "768") {
    await svg.focus();
    await page.keyboard.press("0");
    await setZoom(8);
    await capture(
      `docs/screenshots/2b-final-ux/radar-8x-${info.project.name}.jpg`,
    );
    await svg.scrollIntoViewIfNeeded();
    const b = (await svg.boundingBox())!;
    for (let i = 0; i < 8; i++) {
      await page.mouse.move(b.x + 2, b.y + 2);
      await page.mouse.down();
      await page.mouse.move(
        b.x + b.width - 2,
        b.y + 2 + (b.width - 4) * Math.tan(Math.PI / 12),
        { steps: 3 },
      );
      await page.mouse.up();
    }
    await expect(page.locator(".direction-label")).toHaveCount(1);
    await capture(
      `docs/screenshots/2b-final-ux/radar-8x-limit-${info.project.name}.jpg`,
    );
  }
  await svg.focus();
  await page.keyboard.press("0");
  await page.locator("circle[data-scenario]").first().press("Enter");
  await expect(
    page.getByRole("region", { name: "Быстрый просмотр сценария" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("q")).toBe("SYN-");
  await setZoom(3);
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
  await page.getByRole("link", { name: "Открыть полную карточку" }).click();
  await expect(page).toHaveURL(/from=radar/);
  expect(Number(new URL(page.url()).searchParams.get("zoom"))).toBeCloseTo(3);
  await page.getByRole("link", { name: "← Вернуться к выборке" }).click();
  await expect(page).toHaveURL(/\/scenarios\/radar\?/);
  expect(Number(new URL(page.url()).searchParams.get("zoom"))).toBeCloseTo(3);
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("link", { name: "Сценарии", exact: true })
    .hover();
  await page
    .locator("#scenario-subnav")
    .getByRole("link", { name: "Матрица зрелости" })
    .click();
  await expect(page.locator(".matrix-scatter")).toBeVisible();
  const bad = await page.locator(".matrix-scatter").evaluate((svg) => {
    const left = Number(svg.getAttribute("data-plot-left")),
      bottom = Number(svg.getAttribute("data-plot-bottom")),
      xStep = Number(svg.getAttribute("data-x-step")),
      yStep = Number(svg.getAttribute("data-y-step"));
    return [...svg.querySelectorAll(".matrix-point")].some(
      (n) =>
        Math.round((Number(n.getAttribute("cx")) - left) / xStep + 0.5) !==
          Number(n.getAttribute("data-readiness")) ||
        Math.round((bottom - Number(n.getAttribute("cy"))) / yStep + 0.5) !==
          Number(n.getAttribute("data-maturity")),
    );
  });
  expect(bad).toBe(false);
  await page.keyboard.press("Escape");
  if (process.env.SAVE_UX_SCREENSHOTS && info.project.name !== "768")
    await capture(
      `docs/screenshots/2b-final-ux/matrix-${info.project.name}.jpg`,
    );
  if (info.project.name === "768") {
    const touch = await browser.newContext({
      hasTouch: true,
      viewport: { width: 768, height: 900 },
    });
    const touchPage = await touch.newPage();
    await touchPage.goto(new URL("/scenarios/radar?q=SYN-", page.url()).href);
    await touchPage.getByLabel("Приблизить", { exact: true }).tap();
    await expect(touchPage).toHaveURL(/zoom=1.25/);
    await touchPage.getByLabel("Отдалить", { exact: true }).tap();
    await expect(touchPage).toHaveURL(/zoom=1&/);
    await expect(
      touchPage.getByRole("button", { name: "Сброс масштаба" }),
    ).toHaveCount(0);
    await expect
      .poll(() => touchPage.locator(".direction-label").count())
      .toBeGreaterThanOrEqual(4);
    await touch.close();
  }
});
