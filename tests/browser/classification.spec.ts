import { test, expect } from "@playwright/test";

test("database classifiers filter and survive all workspace routes", async ({
  page,
  request,
}, info) => {
  const refs = await (await request.get("/api/references")).json();
  expect(refs.directions).toHaveLength(8);
  expect(refs.blocks).toHaveLength(11);
  expect(refs.businessDirections).toHaveLength(31);
  let directionId: string | undefined;
  let blockId: string | undefined;
  for (const direction of refs.directions) {
    const result = await (
      await request.get(
        "/api/scenarios?" +
          new URLSearchParams({
            businessDirectionId: refs.businessDirections[0].id,
            directionId: direction.id,
          }),
      )
    ).json();
    if (result.total > 0) {
      directionId = direction.id;
      blockId = result.items[0].blockId;
      break;
    }
  }
  expect(directionId).toBeTruthy();
  await page.goto("/scenarios/catalog");
  await page.locator(".advanced-filters summary").click();
  for (const [label, values, selected] of [
    [
      "БИЗНЕС-НАПРАВЛЕНИЕ",
      refs.businessDirections,
      refs.businessDirections[0].id,
    ],
    ["ТЕХНОЛОГИЧЕСКОЕ НАПРАВЛЕНИЕ", refs.directions, directionId],
    ["БЛОК „ГАЗПРОМ НЕФТЬ“", refs.blocks, blockId],
  ] as const) {
    await expect(page.locator(".shared-filters")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await page.getByRole("button", { name: label, exact: true }).click();
    const name = values.find(
      (v: { id: string; name: string }) => v.id === selected,
    )!.name;
    await page.getByRole("option", { name, exact: true }).click();
    await expect(page.locator(".shared-filters")).toHaveAttribute(
      "aria-busy",
      "false",
    );
  }
  const filtered = await (
    await request.get("/api/scenarios?" + new URL(page.url()).searchParams)
  ).json();
  expect(filtered.total).toBeGreaterThan(0);
  await page.locator(".record-title").first().click();
  await expect(page).toHaveURL(/selected=/);
  const selected = new URL(page.url()).searchParams.get("selected");
  for (const view of ["radar", "maturity", "catalog"]) {
    await page
      .getByRole("navigation", { name: "Основная навигация" })
      .getByRole("link", { name: "Сценарии", exact: true })
      .hover();

    await page
      .locator(`#scenario-subnav a[href*="/scenarios/${view}?"]`)
      .click();
    await expect(page).toHaveURL(new RegExp(`/scenarios/${view}\\?`));
    const params = new URL(page.url()).searchParams;
    expect(params.get("selected")).toBe(selected);
    expect(params.get("blockId")).toBe(blockId);
    expect(params.get("businessDirectionId")).toBe(
      refs.businessDirections[0].id,
    );
    expect(params.get("directionId")).toBe(directionId!);
  }
  if (process.env.SAVE_UX_SCREENSHOTS && info.project.name === "1440") {
    await page.goto("/scenarios/catalog");
    await page.locator(".advanced-filters summary").click();
    await expect(page.locator(".catalog tbody tr")).toHaveCount(25);
    for (const [key, label] of [
      ["blockId", "БЛОК „ГАЗПРОМ НЕФТЬ“"],
      ["businessDirectionId", "БИЗНЕС-НАПРАВЛЕНИЕ"],
      ["directionId", "ТЕХНОЛОГИЧЕСКОЕ НАПРАВЛЕНИЕ"],
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.screenshot({
        path: `docs/screenshots/classification/${key}.jpg`,
      });
      await page.keyboard.press("Escape");
    }
  }
});
