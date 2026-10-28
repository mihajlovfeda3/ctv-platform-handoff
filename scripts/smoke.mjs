import assert from "node:assert/strict";
const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
let checks = 0;
async function request(path, expected = 200) {
  const result = await fetch(new URL(path, base));
  assert.equal(result.status, expected, `${path}: HTTP ${result.status}`);
  checks++;
  return result;
}
for (const path of [
  "/overview",
  "/scenarios/catalog",
  "/scenarios/radar",
  "/scenarios/maturity",
  "/business",
  "/technologies",
  "/portfolio",
]) {
  const html = await (await request(path)).text();
  assert.ok(html.includes("ЦТВ"), `${path}: app shell`);
}
const list = await (await request("/api/scenarios?pageSize=5")).json();
assert.equal(list.items.length, Math.min(list.total, 5));
assert.ok(
  list.total >= 50,
  "Load the synthetic dataset before HTTP smoke tests",
);
const item = list.items[0];
const detail = await (await request(`/api/scenarios/${item.id}`)).json();
assert.equal(detail.scenario.externalId, item.externalId);
await request(`/scenarios/${item.id}`);
const related = await (
  await request(`/api/scenarios/${item.id}/related`)
).json();
assert.ok(Array.isArray(related.technologies));
const references = await (await request("/api/references")).json();
assert.ok(references.directions.length > 0);
const exact = await (
  await request(`/api/scenarios?q=${encodeURIComponent(item.externalId)}`)
).json();
assert.ok(exact.items.some((row) => row.id === item.id));
const filtered = await (
  await request("/api/scenarios?implementation=yes&maturity=3")
).json();
assert.ok(
  filtered.items.every(
    (row) =>
      row.implementation === "yes" &&
      row.assessments.some(
        (a) => a.metric === "market_maturity" && a.value === 3,
      ),
  ),
);
const noResults = await (
  await request("/api/scenarios?q=__unmatched_synthetic__")
).json();
assert.equal(noResults.total, 0);
for (const path of [
  "/api/scenarios?page=0",
  "/api/scenarios?pageSize=101",
  "/api/scenarios?maturity=6",
  "/api/scenarios?directionId=invalid",
  "/api/scenarios/invalid",
])
  await request(path, 400);
await request("/api/scenarios/00000000-0000-4000-8000-000000000000", 404);
await request(
  "/api/scenarios/00000000-0000-4000-8000-000000000000/related",
  404,
);
// A streamed Next.js not-found UI can retain HTTP 200; the data API always returns 404.
const missing = await fetch(
  new URL("/scenarios/00000000-0000-4000-8000-000000000000", base),
);
assert.ok([200, 404].includes(missing.status));
const missingHtml = await missing.text();
assert.ok(missingHtml.includes("Запись не найдена"));
assert.ok(missingHtml.includes('name="robots" content="noindex"'));
checks++;
console.log(`HTTP smoke: ${checks} checks passed at ${base}`);
