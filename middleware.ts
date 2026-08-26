const BACKEND_URL =
  process.env.BACKEND_URL || "https://backup-management.onrender.com";

export const config = {
  matcher: ["/api/:path*"],
};

export default async function middleware(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      },
    });
  }

  const url = new URL(request.url);
  const backendPath = url.pathname.replace(/^\/api\/?/, "/");
  const targetUrl = `${BACKEND_URL}${backendPath}${url.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!["host", "connection", "cookie"].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.arrayBuffer();

  const backendRes = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: body || undefined,
  });

  const resHeaders = new Headers(backendRes.headers);
  resHeaders.delete("www-authenticate");
  resHeaders.set("access-control-allow-origin", "*");

  return new Response(backendRes.body, {
    status: backendRes.status,
    headers: resHeaders,
  });
}
