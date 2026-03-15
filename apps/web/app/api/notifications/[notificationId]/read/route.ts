import { NextRequest, NextResponse } from "next/server";
import { markNotificationRead } from "@/lib/notification";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ notificationId: string }> },
) {
  try {
    const { notificationId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const userId = String(body?.userId || "");

    if (!notificationId || !userId) {
      return NextResponse.json(
        { error: "notificationId and userId are required" },
        { status: 400 },
      );
    }

    const updatedCount = await markNotificationRead(userId, notificationId);

    return NextResponse.json({
      message: updatedCount ? "Notification marked as read" : "No matching notification found",
      updatedCount,
    });
  } catch (error: any) {
    console.error("[WebNotificationRoute] PATCH read failed:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
