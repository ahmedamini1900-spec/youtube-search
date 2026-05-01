import { NextResponse } from "next/server";

const TARGET_BASE = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const SKIP = new Set([
  "host", "connection", "keep-alive",
  "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade",
  "forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port",
]);

export async function middleware(req) {
  // Skip Next.js internal routes and YouTube search page/API
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/search") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  if (!TARGET_BASE) {
    return new NextResponse("ERR_CONFIG_UNSET", { status: 500 });
  }

  try {
    const targetUrl = TARGET_BASE + req.url.replace(req.nextUrl.origin, "");

    const headers = {};
    let clientIp = null;

    for (const [key, val] of req.headers) {
      const k = key.toLowerCase();
      if (SKIP.has(k)) continue;
      if (k.startsWith("x-vercel-")) continue;
      if (k === "x-real-ip") { clientIp = val; continue; }
      if (k === "x-forwarded-for") { if (!clientIp) clientIp = val; continue; }
      headers[k] = val;
    }

    if (clientIp) headers["x-forwarded-for"] = clientIp;

    const method = req.method;
    const hasBody = method !== "GET" && method !== "HEAD";

    const fetchOpts = { method, headers, redirect: "manual" };
    if (hasBody) {
      fetchOpts.body = req.body;
      fetchOpts.duplex = "half";
    }

    const upstream = await fetch(targetUrl, fetchOpts);

    const resHeaders = {};
    for (const [k, v] of upstream.headers) {
      if (k.toLowerCase() === "transfer-encoding") continue;
      resHeaders[k] = v;
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });

  } catch (err) {
    console.error("relay error:", err);
    return new NextResponse("Bad Gateway: Tunnel Failed", { status: 502 });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/search).*)",
  ],
};
