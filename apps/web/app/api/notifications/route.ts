import { NextRequest, NextResponse } from "next/server";
import {
  getNotificationsForUser,
  notifyUser,
  type NotificationType,
} from "@/lib/notification";

export const runtime = "nodejs";

const requireInternalSecretForWrites = (request: NextRequest) => {
  const configuredSecret = process.env.NOTIFICATION_API_SECRET;
  if (!configuredSecret) {
    return true;
  }

  const headerSecret = request.headers.get("x-notification-secret");
  return headerSecret === configuredSecret;
};

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId") || "";
    const limit = Number(request.nextUrl.searchParams.get("limit") || 50);

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const notifications = await getNotificationsForUser(userId, limit);
    const unreadCount = notifications.filter((item) => !item.isRead).length;

    return NextResponse.json({
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error: any) {
    console.error("[WebNotificationRoute] GET failed:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!requireInternalSecretForWrites(request)) {
      return NextResponse.json({ error: "Unauthorized notification write" }, { status: 401 });
    }

    const body = await request.json();
    const {
      userId,
      title,
      message,
      type,
      entityType,
      entityId,
      emailSubject,
    } = body || {};

    if (!userId || !title || !message || !type) {
      return NextResponse.json(
        { error: "userId, title, message and type are required" },
        { status: 400 },
      );
    }

    await notifyUser({
      userId: String(userId),
      title: String(title),
      message: String(message),
      type: String(type) as NotificationType,
      entityType: entityType ? String(entityType) : undefined,
      entityId: entityId ? String(entityId) : undefined,
      emailSubject: emailSubject ? String(emailSubject) : undefined,
    });

    return NextResponse.json({ message: "Notification dispatched" });
  } catch (error: any) {
    console.error("[WebNotificationRoute] POST failed:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
