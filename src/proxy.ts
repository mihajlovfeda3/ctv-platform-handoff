import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
const digest = (value: string) => createHash("sha256").update(value).digest();
export function proxy(request: NextRequest) {
  const enabled =
    process.env.BETA_AUTH_ENABLED === "true" || process.env.RENDER === "true";
  if (!enabled) return NextResponse.next();
  const user = process.env.BETA_AUTH_USER,
    password = process.env.BETA_AUTH_PASSWORD;
  if (!user || !password)
    return new NextResponse("Beta access is not configured", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  const header = request.headers.get("authorization") ?? "";
  let credentials = "";
  if (/^Basic /i.test(header)) {
    try {
      credentials = Buffer.from(header.slice(6), "base64").toString("utf8");
    } catch {}
  }
  if (!timingSafeEqual(digest(credentials), digest(`${user}:${password}`)))
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="CTV beta", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    });
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
