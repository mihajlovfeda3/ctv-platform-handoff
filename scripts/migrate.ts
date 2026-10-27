import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
try {
  await migrate(drizzle(pool), { migrationsFolder: "src/db/migrations" });
  console.log("Миграции применены.");
} finally {
  await pool.end();
}
