import { NextRequest, NextResponse } from "next/server";
import { markAllNotificationsRead } from "@/lib/notification";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = String(body?.userId || "");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const updatedCount = await markAllNotificationsRead(userId);

    return NextResponse.json({
      message: "Notifications marked as read",
      updatedCount,
    });
  } catch (error: any) {
    console.error("[WebNotificationRoute] PATCH read-all failed:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
