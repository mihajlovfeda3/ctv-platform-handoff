import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname } from "node:path";
import { createDatabase } from "../src/db/client";
import { prepareImport } from "../src/features/import/parse";
import { applyImport } from "../src/server/import";

const [input, mappingPath, optionsPath, mode = "--dry-run"] =
  process.argv.slice(2);
if (
  !input ||
  !mappingPath ||
  !optionsPath ||
  !["--dry-run", "--apply"].includes(mode)
)
  throw new Error(
    "Использование: npm run import -- input.csv mapping.json options.json [--dry-run|--apply]",
  );
const format = extname(input).slice(1).toLowerCase();
if (format !== "csv" && format !== "json")
  throw new Error(
    "Поддерживаются CSV и JSON. XLSX требует отдельного адаптера с проверкой форматов ячеек.",
  );
const prepared = prepareImport(
  await readFile(input, "utf8"),
  format,
  JSON.parse(await readFile(mappingPath, "utf8")),
  JSON.parse(await readFile(optionsPath, "utf8")),
);
await mkdir(".local/import-reports", { recursive: true });
const reportPath = `.local/import-reports/${Date.now()}.json`;
let result: unknown = {
  total: prepared.total,
  valid: prepared.valid,
  diagnostics: prepared.diagnostics,
  applied: false,
};
if (prepared.valid && mode === "--apply") {
  const { db, pool } = createDatabase(process.env.DATABASE_URL!);
  try {
    result = await applyImport(db, prepared);
  } catch {
    result = {
      applied: false,
      error:
        "Импорт отменён транзакцией. Проверьте ссылки на справочники и соединение с БД.",
    };
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
await writeFile(reportPath, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ reportPath, result }, null, 2));
if (!prepared.valid) process.exitCode = 1;
