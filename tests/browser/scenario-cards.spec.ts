import { test, expect } from "@playwright/test";
for (const [width, height] of [
  [1366, 768],
  [1440, 900],
  [1920, 1080],
])
  test(`scenario cards readability ${width}`, async ({ page, request }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const list = await (await request.get("/api/scenarios?q=SYN-0004")).json();
    const row = list.items[0];
    const item = await (await request.get(`/api/scenarios/${row.id}`)).json();
    for (const view of ["catalog", "radar", "maturity", "cube"]) {
      await page.goto(`/scenarios/${view}?q=SYN-&selected=${row.id}`);
      const panel = page.getByRole(
        view === "cube" ? "complementary" : "region",
        { name: "Быстрый просмотр сценария", exact: true },
      );
      await expect(panel.getByRole("heading", { level: 2 })).toHaveText(
        row.name,
      );
      await expect(panel).toContainText(item.scenario.description);
      if (view !== "cube") {
        const tech = panel.getByRole("heading", {
          name: "Технологическая классификация",
          exact: true,
        });
        const business = panel.getByRole("heading", {
          name: "Бизнес-контекст",
          exact: true,
        });
        expect((await tech.boundingBox())!.y).toBeLessThan(
          (await business.boundingBox())!.y,
        );
        expect(
          await panel
            .locator(".status")
            .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
        ).toBeGreaterThanOrEqual(13);
      }

      await expect(panel.locator("header, .inspector-top")).not.toContainText(
        row.externalId,
      );
      const cta = panel.getByRole("link", { name: /Открыть полную карточку/ });
      await expect(cta).toBeVisible();
      const description = panel.locator(".inspector-description");
      const expand = panel.getByRole("button", { name: "Развернуть описание" });
      if (await expand.count()) {
        const compactHeight = (await description.boundingBox())!.height;
        await expand.click();
        await expect(
          panel.getByRole("button", { name: "Свернуть описание" }),
        ).toHaveAttribute("aria-expanded", "true");
        expect((await description.boundingBox())!.height).toBeGreaterThan(
          compactHeight,
        );
        await panel.getByRole("button", { name: "Свернуть описание" }).click();
        await expect(expand).toHaveAttribute("aria-expanded", "false");
      }
      if (view === "catalog") {
        const heading = (await panel
          .getByRole("heading", { level: 2 })
          .boundingBox())!;
        const area = (await panel.boundingBox())!;
        expect(heading.y - area.y).toBeLessThan(55);
      }

      if (view === "catalog") {
        await panel.getByRole("heading", { level: 2 }).evaluate((el, name) => {
          el.textContent = name.repeat(5);
        }, row.name + " ");
        await panel
          .locator(".inspector-description")
          .evaluate((el, description) => {
            el.textContent = description.repeat(5);
          }, item.scenario.description + " ");
        expect(
          await panel.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        await expect(cta).toBeVisible();
        await panel.getByRole("heading", { level: 2 }).evaluate((el, name) => {
          el.textContent = name;
        }, row.name);
        await panel
          .locator(".inspector-description")
          .evaluate((el, description) => {
            el.textContent = description;
          }, item.scenario.description);
      }

      const before = (await cta.boundingBox())!;
      await panel.evaluate((el) => {
        const scroller = el.querySelector(
          "[data-inspector-scroll], .inspector-body, details",
        );
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
      });
      expect((await cta.boundingBox())!.y).toBeCloseTo(before.y, 0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (view === "catalog" && width === 1440) {
        await panel.evaluate((el) => {
          el.querySelector(".inspector-body")!.scrollTop = 0;
        });
        await page.screenshot({ path: "output/scenario-cards/quick-view.png" });
      }
      await cta.click();
      await expect(page.locator(".detail-page h1")).toHaveText(row.name);
      await expect(page.locator(".detail-header")).not.toContainText(
        row.externalId,
      );
      expect(
        (await page.locator(".detail-section > h2").allTextContents()).slice(
          0,
          2,
        ),
      ).toEqual(["Технологическая классификация", "Бизнес-контекст"]);

      await expect(page.locator(".detail-header")).toContainText(
        item.scenario.description,
      );
      if (view === "catalog") {
        const heading = page.locator(".detail-header h1");
        await heading.evaluate((el, name) => {
          el.textContent = name.repeat(5);
        }, row.name + " ");
        expect(
          await heading.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        await heading.evaluate((el, name) => {
          el.textContent = name;
        }, row.name);
      }

      await expect(page.locator(".detail-page")).toContainText(
        item.scenario.businessEffect,
      );
      const technical = page.locator("details").filter({
        has: page.getByText(
          "Техническая информация и дополнительные характеристики",
          { exact: true },
        ),
      });
      await technical.locator("summary").click();
      await expect(technical).toContainText(row.externalId);
      await expect(technical).toContainText(item.scenario.id);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (view === "catalog" && width === 1440) {
        await technical.locator("summary").click();
        await page.evaluate(() => {
          (document.activeElement as HTMLElement)?.blur();
          window.scrollTo(0, 0);
        });
        await page.screenshot({
          path: "output/scenario-cards/full-card.png",
          fullPage: true,
        });
      }
      await page.getByRole("link", { name: "← Вернуться к выборке" }).click();
      await expect(panel.getByRole("heading", { level: 2 })).toHaveText(
        row.name,
      );
    }
    expect(errors).toEqual([]);
  });
