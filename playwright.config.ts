import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  outputDir: process.env.PERF_SIZE ? "test-results-large" : "test-results",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3002",
    headless: true,
    channel: process.platform === "win32" ? "chrome" : undefined,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "1440", use: { viewport: { width: 1440, height: 900 } } },
    { name: "1920", use: { viewport: { width: 1920, height: 1080 } } },
    { name: "1280", use: { viewport: { width: 1280, height: 800 } } },
    { name: "768", use: { viewport: { width: 768, height: 900 } } },
  ],
  webServer: {
    command: `npm start -- --port ${new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3002").port}`,
    url: `${process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3002"}/overview`,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
