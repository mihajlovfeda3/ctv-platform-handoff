import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { stableId } from "../../src/lib/identity";

const missingId = stableId("browser-methodology:missing");
const databaseUrl =
  process.env.TEST_BROWSER_DATABASE_URL ?? process.env.DATABASE_URL;
const fixtureEnabled = Boolean(
  databaseUrl && new URL(databaseUrl).pathname.endsWith("_test"),
);

async function fixture(query: string) {
  if (!fixtureEnabled) return;
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(query, [missingId]);
  } finally {
    await client.end();
  }
}
test.beforeAll(async () => {
  await fixture(`insert into scenarios (id, external_id, origin_namespace, name, description, is_synthetic)
    values ($1, 'EDGE-MISSING', 'browser-methodology', 'Проверка отсутствующих сведений', '', true)
    on conflict (id) do nothing`);
});
test.afterAll(async () => {
  await fixture(
    "delete from scenarios where id=$1 and origin_namespace='browser-methodology'",
  );
});

test("one FG and coherent content survive every scenario interface", async ({
  page,
  request,
}, info) => {
  const list = await (await request.get("/api/scenarios?q=SYN-0004")).json();
  const row = list.items[0];
  const item = await (await request.get(`/api/scenarios/${row.id}`)).json();
  const related = await (
    await request.get(`/api/scenarios/${row.id}/related`)
  ).json();
  await page.goto("/scenarios/catalog?q=SYN-0004");
  await expect(page.locator(".catalog")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".record-context")).toHaveText(row.functionalGroup);
  await page.locator(".record-title").click();
  const inspector = page.getByRole("region", {
    name: "Быстрый просмотр сценария",
  });
  await expect(inspector.getByRole("heading", { level: 2 })).toHaveText(
    row.name,
  );
  await expect(
    inspector.getByText("Функциональная группа", { exact: true }),
  ).toHaveCount(1);
  await expect(
    inspector.getByText("Бизнес-направление", { exact: true }),
  ).toHaveCount(0);
  await expect(inspector).toContainText(item.scenario.description);
  await expect(inspector).toContainText(item.scenario.businessEffect);
  await expect(inspector).toContainText(related.technologies[0].technology);
  await expect(inspector).toContainText(related.technologies[0].name);
  const size = (await inspector.boundingBox())!;
  expect(size.width).toBeCloseTo(420);
  if (process.env.SAVE_SEMANTICS_SCREENSHOTS && info.project.name === "2560") {
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.screenshot({
      path: "output/scenario-semantics/inspector.png",
      animations: "disabled",
    });
  }
  await inspector
    .getByRole("link", { name: "Открыть полную карточку" })
    .click();
  await expect(page.locator("h1")).toHaveText(row.name);
  await expect(page.locator(".detail-header")).toContainText(
    item.scenario.description,
  );
  await expect(page.locator(".detail-page")).toContainText(
    item.scenario.businessEffect,
  );
  await expect(page.locator(".detail-page")).toContainText(
    item.scenario.businessChallengeDescription,
  );
  await expect(
    page.getByText("Функциональная группа", { exact: true }),
  ).toHaveCount(1);
  await page.locator("summary").filter({ hasText: "Все оценки" }).click();
  await expect(page.locator(".assessment-line")).toHaveCount(
    item.assessments.length,
  );
  await page
    .locator("summary")
    .filter({ hasText: "Техническая информация" })
    .click();
  await expect(page.getByText("UUID", { exact: true })).toBeVisible();
  await page.locator("summary").filter({ hasText: "Все оценки" }).click();
  await page
    .locator("summary")
    .filter({ hasText: "Техническая информация" })
    .click();
  if (process.env.SAVE_SEMANTICS_SCREENSHOTS && info.project.name === "2560") {
    await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.screenshot({
      path: "output/scenario-semantics/full-card.png",
      fullPage: true,
      animations: "disabled",
    });
  }
  for (const name of ["Свернуть панель", "Развернуть панель"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.mouse.move(600, 110);
    const overflow = await page.locator(".detail-page").evaluate((node) => ({
      page: document.documentElement.scrollWidth > innerWidth,
      title:
        node.querySelector("h1")!.scrollWidth >
        node.querySelector("h1")!.clientWidth,
    }));
    expect(overflow).toEqual({ page: false, title: false });
  }
  await page.getByRole("link", { name: "← Вернуться к выборке" }).click();
  const tabs = page.getByRole("navigation", {
    name: "Представления сценариев",
  });
  for (const view of ["Технологический радар", "Матрица зрелости"]) {
    await tabs.getByRole("link", { name: view, exact: true }).press("Enter");
    await expect(tabs.locator('[aria-current="page"]')).toHaveText(view);
    await expect(inspector.getByRole("heading", { level: 2 })).toHaveText(
      row.name,
    );
    await inspector.getByRole("button", { name: "Свернуть инспектор" }).click();
    await expect(
      inspector.getByRole("button", { name: "Развернуть инспектор" }),
    ).toBeVisible();
    const title = (await inspector.getByRole("heading").boundingBox())!;
    await page.mouse.move(title.x + 8, title.y + 8);
    await page.mouse.down();
    await page.mouse.move(500, 400, { steps: 5 });
    await page.mouse.up();
    await expect(inspector).toHaveAttribute(
      "data-floating-scenario-inspector",
      "true",
    );
    await inspector
      .getByRole("button", { name: "Развернуть инспектор" })
      .click();
    await expect(inspector).toContainText(item.scenario.businessEffect);
    expect(new URL(page.url()).searchParams.get("selected")).toBe(row.id);
  }
});

test("long values and missing fields retain the accepted layout", async ({
  page,
  request,
}) => {
  const { items } = await (
    await request.get("/api/scenarios?q=SYN-&pageSize=100")
  ).json();
  const longest = [...items].sort((a, b) => b.name.length - a.name.length)[0];
  await page.goto(`/scenarios/${longest.id}`);
  await expect(page.locator("h1")).toHaveText(longest.name);
  expect(
    await page
      .locator(".detail-page")
      .evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  test.skip(
    !fixtureEnabled,
    "Missing-value fixture requires an isolated test database",
  );
  await page.goto(`/scenarios/catalog?q=EDGE-MISSING&selected=${missingId}`);
  const inspector = page.getByRole("region", {
    name: "Быстрый просмотр сценария",
  });
  await expect(inspector.locator(".inspector-description")).toHaveText(
    "Не указано",
  );
  await expect(inspector.locator(".catalog-metrics strong")).toHaveText([
    "—",
    "—",
    "—",
  ]);
  await expect(inspector).toContainText("Не указано");
  await inspector
    .getByRole("link", { name: "Открыть полную карточку" })
    .click();
  await expect(page.locator(".detail-header > p")).toHaveText("Не указано");
  await page.locator("summary").filter({ hasText: "Все оценки" }).click();
  await expect(page.locator(".assessment-line")).toHaveCount(0);
  expect(
    await page
      .locator(".detail-page")
      .evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
});
