import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import {
  assertHandoffTarget,
  restoreSnapshot,
  verifySnapshot,
} from "./handoff-db.mjs";

let client;
try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--verify-only"))
    throw new Error("Usage: node scripts/restore-handoff.mjs [--verify-only]");
  assertHandoffTarget(process.env.DATABASE_URL ?? "");
  const bytes = await readFile(
    new URL("../handoff/database-snapshot.json", import.meta.url),
  );
  const manifest = JSON.parse(
    await readFile(
      new URL("../handoff/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  if (
    createHash("sha256").update(bytes).digest("hex") !== manifest.snapshotSha256
  )
    throw new Error(
      "Snapshot file checksum does not match handoff/manifest.json",
    );
  const snapshot = JSON.parse(bytes);
  client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  const result = args.includes("--verify-only")
    ? await verifySnapshot(client, snapshot)
    : await restoreSnapshot(client, snapshot, () =>
        migrate(drizzle(client), {
          migrationsFolder: fileURLToPath(
            new URL("../src/db/migrations", import.meta.url),
          ),
        }),
      );
  console.log(
    args.includes("--verify-only")
      ? "Проверка снимка успешна."
      : "Снимок восстановлен. Существующие данные не перезаписывались.",
    result,
  );
} catch (error) {
  console.error(
    String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, "[DATABASE_URL]"),
  );
  process.exitCode = 1;
} finally {
  await client?.end();
}
