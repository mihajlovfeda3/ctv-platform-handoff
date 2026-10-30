import { expect, it, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
const prior = { ...process.env };
afterEach(() => {
  for (const key of [
    "BETA_AUTH_ENABLED",
    "BETA_AUTH_USER",
    "BETA_AUTH_PASSWORD",
    "RENDER",
  ]) {
    if (prior[key] === undefined) delete process.env[key];
    else process.env[key] = prior[key];
  }
});
it("fails closed on Render, protects pages and APIs, accepts only correct credentials", () => {
  process.env.RENDER = "true";
  delete process.env.BETA_AUTH_USER;
  delete process.env.BETA_AUTH_PASSWORD;
  expect(proxy(new NextRequest("https://beta.test/api/scenarios")).status).toBe(
    503,
  );
  process.env.BETA_AUTH_USER = "demo";
  process.env.BETA_AUTH_PASSWORD = "synthetic-test-password";
  for (const path of ["/overview", "/api/scenarios", "/_next/static/test.js"]) {
    expect(proxy(new NextRequest(`https://beta.test${path}`)).status).toBe(401);
    expect(
      proxy(
        new NextRequest(`https://beta.test${path}`, {
          headers: {
            authorization: `Basic ${Buffer.from("demo:wrong").toString("base64")}`,
          },
        }),
      ).status,
    ).toBe(401);
    expect(
      proxy(
        new NextRequest(`https://beta.test${path}`, {
          headers: {
            authorization: `Basic ${Buffer.from("demo:synthetic-test-password").toString("base64")}`,
          },
        }),
      ).headers.get("x-middleware-next"),
    ).toBe("1");
  }
});
