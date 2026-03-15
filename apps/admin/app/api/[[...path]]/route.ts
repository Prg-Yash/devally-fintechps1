const API_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:5000";

function safeProxy(
  request: Request,
  params: { path?: string[] }
): Promise<Response> {
  return proxy(request, params).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    const isConnectionError =
      message.includes("ECONNREFUSED") ||
      message.includes("fetch failed") ||
      message.includes("Failed to fetch");
    return Promise.resolve(
      Response.json(
        {
          error: isConnectionError
            ? "Cannot reach the API. Ensure Express is running: cd apps/api && npm run dev"
            : message,
        },
        { status: 502, headers: { "Content-Type": "application/json" } }
      )
    );
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return safeProxy(request, await params);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return safeProxy(request, await params);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return safeProxy(request, await params);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return safeProxy(request, await params);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  return safeProxy(request, await params);
}

async function proxy(
  request: Request,
  { path = [] }: { path?: string[] }
) {
  const pathSegments = path.length > 0 ? path.join("/") : "";
  const url = new URL(request.url);
  const query = url.searchParams.toString();
  const targetUrl = `${API_TARGET}/${pathSegments}${query ? `?${query}` : ""}`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");

  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.text();
  const res = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const resBody = await res.text();

  if (!isJson && resBody.trimStart().startsWith("<")) {
    return new Response(
      JSON.stringify({
        error: res.ok
          ? "API returned HTML instead of JSON."
          : "Cannot reach the API. Ensure Express is running: cd apps/api && npm run dev",
      }),
      {
        status: res.ok ? 502 : res.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const responseHeaders = new Headers(res.headers);
  responseHeaders.delete("transfer-encoding");

  return new Response(resBody, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });
}
