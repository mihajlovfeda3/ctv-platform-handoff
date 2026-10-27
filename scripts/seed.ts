import "dotenv/config";
import { createDatabase } from "../src/db/client";
import { seedDatabase } from "../src/server/seed";
const { db, pool } = createDatabase(process.env.DATABASE_URL!);
try {
  console.log(await seedDatabase(db, Number(process.argv[2] ?? 80)));
} finally {
  await pool.end();
}
