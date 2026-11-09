import { describe, it, expect, afterAll, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import {
  assertHandoffTarget,
  validateSnapshot,
  restoreSnapshot,
  verifySnapshot,
} from "../scripts/handoff-db.mjs";

const bytes = readFileSync(
  new URL("../handoff/database-snapshot.json", import.meta.url),
);
const snapshot: {
  format: string;
  tables: {
    name: string;
    columns: { column_name: string; data_type: string }[];
    rows: Record<string, unknown>[];
    checksum: string;
  }[];
} = JSON.parse(bytes.toString());
const manifest = JSON.parse(
  readFileSync(new URL("../handoff/manifest.json", import.meta.url), "utf8"),
);
describe("Portable handoff restoration", () => {
  const pg = new PGlite();
  afterAll(() => pg.close());
  it("accepts only dedicated local development/test databases", () => {
    expect(() =>
      assertHandoffTarget("postgresql://ctv:local@127.0.0.1:5434/ctv_handoff"),
    ).not.toThrow();
    expect(() =>
      assertHandoffTarget(
        "postgresql://ctv:local@localhost/ctv_verify_handoff_test",
      ),
    ).not.toThrow();
    for (const value of [
      "postgresql://ctv:local@127.0.0.1/ctv",
      "postgresql://ctv:local@cloud.example/ctv_handoff",
      "https://localhost/ctv_handoff",
    ])
      expect(() => assertHandoffTarget(value)).toThrow();
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      manifest.snapshotSha256,
    );
    expect(() =>
      validateSnapshot({
        ...snapshot,
        tables: [{ ...snapshot.tables[0], name: "invalid;table" }],
      }),
    ).toThrow();
  });
  it("restores the real supplied snapshot with original IDs, scores, timestamps and links", async () => {
    const result = await restoreSnapshot(pg, snapshot, () =>
      migrate(drizzle(pg), { migrationsFolder: "src/db/migrations" }),
    );
    expect(result).toEqual({ tables: 26, scenarios: 80, checksums: "match" });
    const actual = await pg.query(
      "select id, external_id, implementation from scenarios order by id",
    );
    const expected = snapshot.tables
      .find((t) => t.name === "scenarios")!
      .rows.map((r) => ({
        id: String(r.id),
        external_id: String(r.external_id),
        implementation: String(r.implementation),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    expect(actual.rows).toEqual(expected);
    expect(await verifySnapshot(pg, snapshot)).toEqual(result);
  });
  it("refuses a second restoration before migration and keeps all existing data", async () => {
    const migrateAgain = vi.fn();
    await expect(restoreSnapshot(pg, snapshot, migrateAgain)).rejects.toThrow(
      "Destination contains data",
    );
    expect(migrateAgain).not.toHaveBeenCalled();
    expect((await verifySnapshot(pg, snapshot)).scenarios).toBe(80);
  });
  it("rolls back every inserted table if a data checksum is wrong", async () => {
    const empty = new PGlite();
    try {
      const changed = structuredClone(snapshot);
      changed.tables[0].checksum = "0".repeat(32);
      await expect(
        restoreSnapshot(empty, changed, () =>
          migrate(drizzle(empty), { migrationsFolder: "src/db/migrations" }),
        ),
      ).rejects.toThrow("Snapshot verification failed");
      expect(
        (await empty.query("select count(*)::int as count from scenarios"))
          .rows,
      ).toEqual([{ count: 0 }]);
    } finally {
      await empty.close();
    }
  });
});
