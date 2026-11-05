import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { stableId } from "../../src/lib/identity";

const id = stableId("browser-implementation:legacy");
const databaseUrl =
  process.env.TEST_BROWSER_DATABASE_URL ?? process.env.DATABASE_URL;
const fixtureEnabled = Boolean(
  databaseUrl && new URL(databaseUrl).pathname.endsWith("_test"),
);

async function fixture(remove = false) {
  if (!fixtureEnabled) return;
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(
      "delete from scenarios where id=$1 and origin_namespace='browser-implementation'",
      [id],
    );
    if (remove) return;
    await client.query(
      `insert into scenarios (id, external_id, origin_namespace, name, description, implementation, is_synthetic)
      values ($1, 'EDGE-STATUS', 'browser-implementation', 'Старый сценарий без подтверждённого статуса', 'Проверка сохранения исходных данных', 'unknown', true)`,
      [id],
    );
    for (const [metric, value] of [
      ["market_maturity", 3],
      ["organizational_readiness", 4],
      ["business_impact", 2],
    ])
      await client.query(
        `insert into scenario_assessments (scenario_id, metric, value, assessed_at, organizational_context, is_synthetic)
        values ($1, $2, $3, '2026-01-01', 'synthetic-lab', true)`,
        [id, metric, value],
      );
    await client.query(
      `insert into scenario_technologies (scenario_id, method_id, is_synthetic)
      select $1, method_id, true from scenario_technologies where scenario_id<>$1 limit 1`,
      [id],
    );
  } finally {
    await client.end();
  }
}

test.beforeAll(() => fixture());
test.afterAll(() => fixture(true));

test("two confirmed statuses filter API and retain their colours on every screen", async ({
  page,
  request,
}) => {
  for (const [status, label, colour] of [
    ["yes", "Реализуется", "rgb(63, 144, 208)"],
    ["no", "Не реализуется", "rgb(230, 161, 91)"],
  ]) {
    const result = await request.get(
      `/api/scenarios?q=SYN-&implementation=${status}`,
    );
    expect(result.ok()).toBe(true);
    const list = await result.json();
    expect(list.total).toBeGreaterThan(0);
    expect(
      list.items.every(
        (row: { implementation: string }) => row.implementation === status,
      ),
    ).toBe(true);
    const analytics = await (
      await request.get(
        `/api/scenarios/analytics?q=SYN-&implementation=${status}`,
      )
    ).json();
    expect(
      analytics.rows.every(
        (row: { implementation: string }) => row.implementation === status,
      ),
    ).toBe(true);
    for (const view of ["catalog", "radar", "maturity"]) {
      await page.goto(
        `/scenarios/${view}?q=SYN-&implementation=${status}&selected=${list.items[0].id}`,
      );
      await expect(page.locator(`.status.${status}`).first()).toContainText(
        label,
      );
      await expect(page.locator(`.status.${status} i`).first()).toHaveCSS(
        "background-color",
        colour,
      );
      if (view !== "catalog")
        await expect(page.locator(".analytics-legend")).not.toContainText(
          "Статус неизвестен",
        );
      await page
        .getByRole("link", {
          name: "Закрыть инспектор",
          exact: true,
        })
        .click();
      await expect(page).not.toHaveURL(/selected=/);
      const control = page.getByRole("button", {
        name: "РЕАЛИЗАЦИЯ",
        exact: true,
      });
      await control.click();
      await expect(
        page.getByRole("option", { name: "Реализуется", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("option", { name: "Не реализуется", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("option", { name: /Неизвестно|уточнения/ }),
      ).toHaveCount(0);
      await page.keyboard.press("Escape");
    }
    await page.goto(`/scenarios/${list.items[0].id}`);
    await expect(page.locator(`.status.${status}`)).toContainText(label);
  }
});

test("legacy unknown remains unconfirmed and obsolete filters are harmless", async ({
  page,
  request,
}) => {
  test.skip(
    !fixtureEnabled,
    "Requires an isolated _test database for the legacy fixture",
  );
  const detail = await (await request.get(`/api/scenarios/${id}`)).json();
  expect(detail.scenario.implementation).toBe("unknown");
  for (const endpoint of ["/api/scenarios", "/api/scenarios/analytics"]) {
    const response = await request.get(
      `${endpoint}?q=EDGE-STATUS&implementation=unknown`,
    );
    expect(response.ok()).toBe(true);
    expect((await response.json()).total).toBe(1);
    for (const status of ["yes", "no"])
      expect(
        (
          await (
            await request.get(
              `${endpoint}?q=EDGE-STATUS&implementation=${status}`,
            )
          ).json()
        ).total,
      ).toBe(0);
  }
  for (const view of ["catalog", "radar", "maturity"]) {
    await page.goto(
      `/scenarios/${view}?q=EDGE-STATUS&implementation=unknown&selected=${id}`,
    );
    await expect(
      page.getByText("Статус требует уточнения", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.locator(".status")).toHaveCount(0);
    await expect(page.locator(".filter-chips")).not.toContainText(
      "Статус неизвестен",
    );
    if (view !== "catalog") {
      const mark = page.locator(`[data-scenario="${id}"]`).first();
      await expect(mark).toHaveAttribute("fill", "#8495a5");
    }
    const tab = page
      .getByRole("navigation", { name: "Представления сценариев" })
      .getByRole("link", { name: "Каталог", exact: true });
    await expect(tab).not.toHaveAttribute("href", /implementation=unknown/);
  }
  await page.goto(`/scenarios/${id}?implementation=unknown&from=catalog`);
  await expect(
    page.getByText("Статус требует уточнения", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".status")).toHaveCount(0);
});
