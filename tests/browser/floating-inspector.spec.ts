import { expect, test, type Locator, type Page } from "@playwright/test";

async function drag(page: Page, title: Locator, x: number, y: number) {
  const box = (await title.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 7);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
}

for (const view of ["radar", "points", "cells"] as const) {
  test(`floating scenario inspector in ${view}`, async ({ page }, info) => {
    const route = view === "radar" ? "radar" : "maturity";
    await page.goto(
      `/scenarios/${route}?q=SYN-&${view === "radar" ? "mode=points" : `matrixMode=${view}`}`,
    );
    await expect(page.locator(".shared-filters")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    const marks = page.locator(
      view === "radar" ? ".interactive-radar [data-scenario]" : ".matrix-point",
    );
    const cells = page.locator("button[data-cell]:not([data-empty])");
    const members = page.locator(".group-members a");
    async function select(index: number) {
      if (view !== "cells") {
        await marks.nth(index).press("Enter");
      } else {
        await cells.nth(index).click();
        await members.first().click();
      }
    }

    await select(0);
    const panel = page.getByRole("region", {
      name: "Быстрый просмотр сценария",
    });
    const collapse = panel.getByRole("button", { name: "Свернуть инспектор" });
    const expand = panel.getByRole("button", { name: "Развернуть инспектор" });
    await expect(collapse).toBeVisible();
    const standard = (await panel.boundingBox())!;
    const initialUrl = page.url();
    const firstName = await panel
      .getByRole("heading", { level: 2 })
      .textContent();
    const camera = page.getByTestId("camera");
    const cameraTransform =
      view === "radar" ? await camera.getAttribute("transform") : null;

    await collapse.click();
    await expect(expand).toBeFocused();
    await expect(panel.getByText("Технологическая классификация")).toHaveCount(
      0,
    );
    expect(page.url()).toBe(initialUrl);
    const title = panel.getByRole("heading", { level: 2 });
    const { width, height } = page.viewportSize()!;
    await drag(page, title, width - 1, height - 1);
    const bottom = (await panel.boundingBox())!;
    expect(bottom.x + bottom.width).toBeLessThanOrEqual(width - 7);
    expect(bottom.y + bottom.height).toBeLessThanOrEqual(height - 7);
    await drag(page, title, 1, 1);
    const top = (await panel.boundingBox())!;
    expect(top.x).toBeGreaterThanOrEqual(8);
    expect(top.y).toBeGreaterThanOrEqual(8);
    expect(page.url()).toBe(initialUrl);
    if (cameraTransform)
      await expect(camera).toHaveAttribute("transform", cameraTransform);

    await drag(page, title, 269, 336);
    const moved = (await panel.boundingBox())!;
    expect(Math.abs(moved.x - top.x)).toBeGreaterThan(100);
    if (
      process.env.SAVE_FLOATING_SCREENSHOTS &&
      info.project.name === "1920" &&
      view !== "cells"
    ) {
      await page.screenshot({
        path: `output/floating-inspector/${route}.png`,
        animations: "disabled",
      });
    }

    // Leave the plot unobstructed before interacting with the next mark or cell.
    await drag(page, title, width - 1, height - 1);
    const parked = (await panel.boundingBox())!;
    await select(1);
    await expect(expand).toBeVisible();
    await expect(title).not.toHaveText(firstName!);
    expect((await panel.boundingBox())!.x).toBeCloseTo(parked.x, 0);
    const selected = new URL(page.url()).searchParams.get("selected")!;
    const full = panel.getByRole("link", { name: "Открыть полную карточку →" });
    await expect(full).toHaveAttribute(
      "href",
      new RegExp(`/scenarios/${selected}\\?`),
    );

    await expand.click();
    await expect(collapse).toBeFocused();
    const restored = (await panel.boundingBox())!;
    expect(restored.x).toBeCloseTo(standard.x, 0);
    expect(restored.width).toBeCloseTo(standard.width, 0);
    await collapse.click();
    await full.click();
    await expect(page).toHaveURL(new RegExp(`/scenarios/${selected}\\?`));
    await page.getByRole("link", { name: "← Вернуться к выборке" }).click();
    await expect(collapse).toBeVisible();
    await collapse.click();
    await panel.getByRole("link", { name: "Закрыть инспектор" }).click();
    await expect(panel).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has("selected")).toBe(false);
  });
}

test("catalog inspector has its original controls", async ({ page }) => {
  await page.goto("/scenarios/catalog?q=SYN-0001");
  await page.locator(".catalog tbody tr .record-title").first().click();
  const panel = page.getByRole("region", { name: "Быстрый просмотр сценария" });
  await expect(panel).toHaveClass(/catalog-inspector/);
  await expect(
    panel.getByRole("button", { name: "Свернуть инспектор" }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("link", { name: "Открыть полную карточку →" }),
  ).toBeVisible();
});

for (const [route, mode] of [
  ["radar", "mode=points"],
  ["maturity", "matrixMode=points"],
  ["maturity", "matrixMode=cells"],
]) {
  test(`expanded inspector keeps the action visible in ${route} ${mode}`, async ({
    page,
    request,
  }, info) => {
    const data = await (await request.get("/api/scenarios?q=SYN-0004")).json();
    const id = data.items[0].id;
    await page.goto(`/scenarios/${route}?${mode}&selected=${id}`);
    const panel = page.getByRole("region", {
      name: "Быстрый просмотр сценария",
    });
    const scrollArea = panel.locator("[data-inspector-scroll]");
    const action = panel.getByRole("link", {
      name: "Открыть полную карточку →",
    });
    await expect(panel).toHaveCSS("width", "410px");
    await expect(
      panel.getByText("БЫСТРЫЙ ПРОСМОТР", { exact: true }),
    ).toHaveCount(0);
    const collapse = panel.getByRole("button", { name: "Свернуть инспектор" });
    const close = panel.getByRole("link", { name: "Закрыть инспектор" });
    expect((await collapse.boundingBox())!.y).toBeCloseTo(
      (await close.boundingBox())!.y,
      0,
    );
    const save =
      process.env.SAVE_INSPECTOR_FOOTER_SCREENSHOTS &&
      info.project.name === "1920" &&
      mode !== "matrixMode=cells";
    if (save)
      await page.screenshot({
        path: `output/inspector-footer/${route}-expanded.png`,
        animations: "disabled",
      });

    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: viewport.width, height: 670 });
    await expect
      .poll(async () => {
        const button = (await action.boundingBox())!;
        return button.y + button.height;
      })
      .toBeLessThanOrEqual(670);
    const initialButton = (await action.boundingBox())!;
    const initialScroll = await page.evaluate(() => window.scrollY);
    await scrollArea.hover();
    await page.mouse.wheel(0, 2000);
    await expect
      .poll(() =>
        scrollArea.evaluate(
          (el) => el.scrollHeight - el.clientHeight - el.scrollTop,
        ),
      )
      .toBeLessThan(2);
    const last = await scrollArea.locator("p").last().boundingBox();
    const area = (await scrollArea.boundingBox())!;
    expect(last!.y + last!.height).toBeLessThanOrEqual(area.y + area.height);
    expect((await action.boundingBox())!.y).toBeCloseTo(initialButton.y, 0);
    expect(await page.evaluate(() => window.scrollY)).toBe(initialScroll);
    await action.click();
    await expect(page).toHaveURL(new RegExp(`/scenarios/${id}\\?`));

    if (save) {
      await page.setViewportSize(viewport);
      await page.getByRole("link", { name: "← Вернуться к выборке" }).click();
      await collapse.click();
      await expect(
        panel.getByRole("button", { name: "Развернуть инспектор" }),
      ).toBeVisible();
      await drag(page, panel.getByRole("heading", { level: 2 }), 370, 390);
      await page.screenshot({
        path: `output/inspector-footer/${route}-collapsed.png`,
        animations: "disabled",
      });
    }
  });
}
