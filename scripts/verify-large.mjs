import "dotenv/config";
import { spawn } from "node:child_process";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "Требуется отдельная TEST_DATABASE_URL с суффиксом _test после npm run test:postgres",
  );
const child = spawn(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/browser/analytics.spec.ts",
  ],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      DATABASE_URL: url,
      PERF_SIZE: "2500",
      PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3003",
      SAVE_UX_SCREENSHOTS: "",
    },
  },
);
child.on("exit", (code) => process.exit(code ?? 1));
