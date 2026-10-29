import { test, expect } from "@playwright/test";

test("heading stays offset without moving the table; animated menu and range controls", async ({
  page,
}) => {
  await page.goto("/scenarios/catalog");
  await expect(page.locator(".shared-filters")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const heading = (await page.locator("h1").boundingBox())!;
  const table = (await page.locator(".catalog").boundingBox())!;
  expect(table.x - heading.x).toBe(12);
  const group = page
    .locator(".sidebar")
    .getByRole("link", { name: "Сценарии", exact: true });
  const disclosure = page.locator(".nav-disclosure");
  await expect(disclosure).toHaveCSS("transition-duration", "0.22s");
  await group.hover();
  await expect(disclosure).toHaveAttribute("data-open", "true");
  await expect(page.locator("#scenario-subnav")).toBeVisible();
  await expect
    .poll(async () => (await disclosure.boundingBox())!.height)
    .toBeGreaterThan(100);
  await expect(page.locator("#scenario-subnav")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  const mainItem = (await group.boundingBox())!;
  const subItems = (await page.locator("#scenario-subnav").boundingBox())!;
  expect(mainItem.width).toBeGreaterThan(180);
  expect(subItems.y).toBeGreaterThanOrEqual(mainItem.y + mainItem.height);
  await group.focus();
  await page.locator("[name=q]").focus();
  // A programmatic inspector/page focus change must not override pointer hover.
  await page.waitForTimeout(300);
  await expect(disclosure).toHaveAttribute("data-open", "true");
  await page.mouse.move(700, 100);
  await expect(page.locator("#scenario-subnav")).toBeHidden();
  await expect
    .poll(async () => (await disclosure.boundingBox())!.height)
    .toBe(0);
  await expect(disclosure).toHaveAttribute("inert", "");
  await page.locator(".advanced-filters summary").click();
  for (const [prefix, max] of [
    ["maturity", 5],
    ["readiness", 7],
    ["impact", 3],
  ] as const) {
    const lower = page.locator(`[name=${prefix}Min]`);
    const upper = page.locator(`[name=${prefix}Max]`);
    await lower.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(new RegExp(`${prefix}Min=2`));
    await expect(upper).toHaveValue(String(max));
    await expect(lower).toHaveValue("2");
    const track = lower.locator("..");
    await expect(track.locator(".range-handle").first()).toHaveCSS(
      "transition-duration",
      "0.14s, 0.14s, 0.14s, 0.14s",
    );
    await upper.scrollIntoViewIfNeeded();
    const handle = (await track.locator(".range-handle").last().boundingBox())!;
    const bounds = (await track.boundingBox())!;
    await page.mouse.move(
      handle.x + handle.width / 2,
      handle.y + handle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + bounds.width * ((max - 2) / (max - 1)),
      handle.y + handle.height / 2,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect(upper).toHaveValue(String(max - 1));
    await expect(page).toHaveURL(new RegExp(`${prefix}Max=${max - 1}`));
  }
});

test("reduced motion disables menu and slider transitions", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/scenarios/catalog");
  await expect(page.locator(".shared-filters")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".nav-disclosure")).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await page.locator(".advanced-filters summary").click();
  await expect(page.locator(".range-handle").first()).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await expect(page.locator(".range-selection").first()).toHaveCSS(
    "transition-duration",
    "0s",
  );
});
