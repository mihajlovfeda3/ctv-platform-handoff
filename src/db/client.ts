import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export function createDatabase(url: string) {
  if (!url)
    throw new Error(
      "Задайте DATABASE_URL в локальном .env по образцу .env.example",
    );
  const pool = new Pool({
    connectionString: url,
    max: 8,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 15000,
  });
  pool.on("error", () => console.error("CTV database connection interrupted"));
  return { db: drizzle(pool, { schema }), pool };
}
export type Database = ReturnType<typeof createDatabase>["db"];
const state = globalThis as typeof globalThis & {
  ctvDatabase?: ReturnType<typeof createDatabase>;
};
export function getDatabase() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is not configured");
  return (state.ctvDatabase ??= createDatabase(process.env.DATABASE_URL)).db;
}
