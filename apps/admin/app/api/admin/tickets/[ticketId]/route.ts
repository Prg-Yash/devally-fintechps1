/**
 * Dedicated route for PATCH /api/admin/tickets/[ticketId].
 * Proxies to Express and always returns JSON (no HTML error pages).
 */
const API_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:5000"; 
//this is so that in production, it can point to the actual API URL instead of localhost. Make sure to set API_PROXY_TARGET in your environment variables when deploying.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params;
  if (!ticketId) {
    return Response.json({ error: "ticketId is required" }, { status: 400 });
  }

  let body: string | undefined;
  try {
    body = await request.text();
  } catch {
    return Response.json({ error: "Failed to read request body" }, { status: 400 });
  }

  const targetUrl = `${API_TARGET}/admin/tickets/${ticketId}`;
  try {
    const res = await fetch(targetUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: body || undefined,
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return Response.json(
        { error: res.ok ? "Invalid response from API" : "API returned non-JSON. Ensure Express is running on port 5000." },
        { status: res.ok ? 500 : res.status }
      );
    }

    return Response.json(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isConnectionError =
      message.includes("ECONNREFUSED") ||
      message.includes("fetch failed") ||
      message.includes("Failed to fetch");
    return Response.json(
      {
        error: isConnectionError
          ? "Cannot reach the API. Start it with: cd apps/api && npm run dev"
          : message,
      },
      { status: 502 }
    );
  }
}
