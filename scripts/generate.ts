import { writeFile, mkdir } from "node:fs/promises";
import { generateDataset } from "./synthetic";
await mkdir(".local/fixtures", { recursive: true });
const size = Number(process.argv[2] ?? 80);
await writeFile(
  `.local/fixtures/synthetic-${size}.json`,
  JSON.stringify(generateDataset(size), null, 2),
);
console.log(
  `Создан синтетический набор: .local/fixtures/synthetic-${size}.json`,
);
