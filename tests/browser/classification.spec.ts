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
  await expect(page.locator("[name=businessDirectionId]")).toBeVisible();
  await page
    .locator("[name=businessDirectionId]")
    .selectOption(refs.businessDirections[0].id);
  await expect(page).toHaveURL(/businessDirectionId=/);
  await expect(page.locator(".shared-filters")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.locator("[name=directionId]").selectOption(directionId!);
  await expect(page).toHaveURL(/directionId=/);
  await expect(page.locator(".shared-filters")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.locator("[name=blockId]").selectOption(blockId!);
  await expect(page).toHaveURL(/blockId=/);
  await expect(page.locator(".shared-filters")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const filtered = await (
    await request.get("/api/scenarios?" + new URL(page.url()).searchParams)
  ).json();
  expect(filtered.total).toBeGreaterThan(0);
  await page.locator(".record-title").first().click();
  await expect(page).toHaveURL(/selected=/);
  const selected = new URL(page.url()).searchParams.get("selected");
  for (const view of ["radar", "maturity", "catalog"]) {
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
    await expect(page.locator(".catalog tbody tr")).toHaveCount(12);
    for (const name of ["blockId", "businessDirectionId", "directionId"]) {
      const select = page.locator(`[name=${name}]`);
      // Native OS popups are outside page screenshots. Show the same DB-backed
      // options as a native listbox solely for reproducible screenshot capture.
      await select.evaluate((node: HTMLSelectElement) => {
        node.size = Math.max(2, node.options.length);
        node.style.width = "100%";
        node.style.height = `${Math.max(2, node.options.length) * 26}px`;
        node.parentElement!.style.gridColumn = "1 / -1";
      });
      await page.screenshot({
        path: `docs/screenshots/classification/${name}.jpg`,
        fullPage: true,
      });
      await select.evaluate((node: HTMLSelectElement) => {
        node.size = 0;
        node.style.width = "";
        node.style.height = "";
        node.parentElement!.style.gridColumn = "";
      });
    }
  }
});
