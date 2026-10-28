import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:3002",
    headless: true,
    channel: process.platform === "win32" ? "chrome" : undefined,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "1440", use: { viewport: { width: 1440, height: 900 } } },
    { name: "1920", use: { viewport: { width: 1920, height: 1080 } } },
    { name: "768", use: { viewport: { width: 768, height: 900 } } },
  ],
  webServer: {
    command: "npm start -- --port 3002",
    url: "http://127.0.0.1:3002/overview",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
