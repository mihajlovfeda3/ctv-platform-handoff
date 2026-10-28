import "dotenv/config";
import { createDatabase } from "../src/db/client";
import { scenarioAnalytics } from "../src/server/analytics";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Only dedicated test DB");
const { db, pool } = createDatabase(url);
try {
  const timings: number[] = [];
  let bytes = 0,
    total = 0;
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    const result = await scenarioAnalytics({ q: "SYN-" }, db);
    timings.push(performance.now() - start);
    bytes = Buffer.byteLength(JSON.stringify(result));
    total = result.total;
  }
  console.log(
    JSON.stringify({
      total,
      queries: 10,
      medianMs: timings.sort((a, b) => a - b)[5],
      maxMs: Math.max(...timings),
      payloadBytes: bytes,
      nodeRssBytes: process.memoryUsage().rss,
    }),
  );
} finally {
  await pool.end();
}
