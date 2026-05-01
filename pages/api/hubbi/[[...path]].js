import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const config = {
  api: { bodyParser: false },
  supportsResponseStreaming: true,
  maxDuration: 60,
};

const TARGET_BASE = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const EXCLUDED_HEADERS = new Set([
  "host", "connection", "keep-alive",
  "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade",
  "forwarded", "x-forwarded-host", "x-forwarded-proto", "x-forwarded-port",
]);

export default async function hubbi_handler(req, res) {
  if (!TARGET_BASE) {
    res.statusCode = 500;
    return res.end("ERR_CONFIG_UNSET");
  }

  try {
    // Strip the /api/hubbi prefix to get the real path
    const realPath = req.url.replace(/^\/api\/hubbi/, "") || "/";
    const target = TARGET_BASE + realPath;

    const headers = {};
    let ip = null;

    Object.keys(req.headers).forEach(k => {
      const lk = k.toLowerCase();
      const lv = req.headers[k];
      if (EXCLUDED_HEADERS.has(lk)) return;
      if (lk.startsWith("x-vercel-")) return;
      if (lk === "x-real-ip") { ip = lv; return; }
      if (lk === "x-forwarded-for") { if (!ip) ip = lv; return; }
      headers[lk] = Array.isArray(lv) ? lv.join(", ") : lv;
    });

    if (ip) headers["x-forwarded-for"] = ip;

    const hasBody = !["GET", "HEAD"].includes(req.method);
    const opts = {
      method: req.method,
      headers,
      redirect: "manual",
      ...(hasBody ? { body: Readable.toWeb(req), duplex: "half" } : {}),
    };

    const upstream = await fetch(target, opts);
    res.statusCode = upstream.status;

    for (const [k, v] of upstream.headers) {
      if (k.toLowerCase() === "transfer-encoding") continue;
      try { res.setHeader(k, v); } catch (e) {}
    }

    if (upstream.body) {
      await pipeline(Readable.fromWeb(upstream.body), res);
    } else {
      res.end();
    }
  } catch (e) {
    console.error("HUBBI-RELAY-ERR", e);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end("ERR_COMM_FAIL");
    }
  }
}
