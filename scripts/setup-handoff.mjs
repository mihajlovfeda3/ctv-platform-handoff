import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const password = randomBytes(24).toString("base64url");
const content = `POSTGRES_USER=ctv
POSTGRES_PASSWORD=${password}
POSTGRES_DB=ctv_handoff
POSTGRES_PORT=5434
DATABASE_URL=postgresql://ctv:${password}@127.0.0.1:5434/ctv_handoff
BETA_AUTH_ENABLED=false
`;
try {
  await writeFile(new URL("../.env", import.meta.url), content, {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    "Создана локальная .env с отдельным случайным паролем. Пароль не выводится.",
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("Существующая .env сохранена без изменений.");
}
