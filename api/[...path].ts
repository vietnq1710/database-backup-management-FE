import type { IncomingMessage, ServerResponse } from "http";

const BACKEND_URL =
  process.env.BACKEND_URL || "https://backup-management.onrender.com";

const SKIP_REQ_HEADERS = new Set([
  "host",
  "connection",
  "cookie",
  "content-length",
  "transfer-encoding",
]);
const SKIP_RES_HEADERS = new Set(["www-authenticate", "transfer-encoding"]);

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    });
    return res.end();
  }

  const rawPath = req.url?.replace(/^\/api\/?/, "/") ?? "/";
  const targetUrl = `${BACKEND_URL}${rawPath}`;

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!SKIP_REQ_HEADERS.has(key.toLowerCase()) && value) {
      headers[key] = Array.isArray(value) ? value[0] : value;
    }
  }

  let body: Buffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await new Promise<Buffer>((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }

  const backendRes = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: body?.length ? body : undefined,
  });

  const resHeaders: Record<string, string> = {};
  backendRes.headers.forEach((value, key) => {
    if (!SKIP_RES_HEADERS.has(key.toLowerCase())) {
      resHeaders[key] = value;
    }
  });
  resHeaders["access-control-allow-origin"] = "*";

  res.writeHead(backendRes.status, resHeaders);

  const buf = Buffer.from(await backendRes.arrayBuffer());
  res.end(buf);
}
