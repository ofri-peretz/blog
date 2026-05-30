interface VisitorEvent {
  timestamp: string;
  ip: string;
  userAgent: string;
  referrer: string;
  page: string;
  country?: string;
  city?: string;
  event?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request
      .json()
      .catch(() => ({}))) as Partial<VisitorEvent>;
    const headers = request.headers;
    const forwardedFor = headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
    const userAgent = headers.get("user-agent") || "unknown";
    const referrer =
      headers.get("referer") || (body.referrer as string) || "direct";
    const country = headers.get("x-vercel-ip-country") || undefined;
    const city = headers.get("x-vercel-ip-city") || undefined;

    const visitorEvent: VisitorEvent = {
      timestamp: new Date().toISOString(),
      ip,
      userAgent,
      referrer,
      page: body.page || "/",
      country,
      city,
      event: body.event || "pageview",
    };

    console.log("[VISITOR]", JSON.stringify(visitorEvent));
    return Response.json({ success: true });
  } catch (error) {
    console.error("[VISITOR_ERROR]", error);
    return Response.json({ success: false });
  }
}
