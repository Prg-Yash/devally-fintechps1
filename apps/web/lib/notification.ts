import "server-only";

import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { sendNotificationEmail } from "@/lib/email";

export type NotificationType = "AGREEMENT" | "TICKET" | "PURCHASE";

export type NotificationRow = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
};

let notificationTableEnsured = false;

const ensureNotificationTable = async () => {
  if (notificationTableEnsured) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "notification" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "entityType" TEXT,
      "entityId" TEXT,
      "isRead" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "notification_userId_createdAt_idx" ON "notification" ("userId", "createdAt" DESC);',
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "notification_userId_isRead_idx" ON "notification" ("userId", "isRead");',
  );

  notificationTableEnsured = true;
};

export const createNotificationForUser = async ({
  userId,
  title,
  message,
  type,
  entityType,
  entityId,
}: {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  entityType?: string;
  entityId?: string;
}) => {
  await ensureNotificationTable();

  console.info(`[WebNotification] Creating in-app notification user=${userId} type=${type} title="${title}"`);

  const created = await prisma.notification.create({
    data: {
      id: randomUUID(),
      userId,
      title,
      message,
      type,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
    },
    select: { id: true },
  });

  console.info(`[WebNotification] In-app notification saved id=${created.id} user=${userId}`);
  return created.id;
};

export const notifyUser = async ({
  userId,
  title,
  message,
  type,
  entityType,
  entityId,
  emailSubject,
  emailActionUrl,
  emailActionLabel,
}: {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  entityType?: string;
  entityId?: string;
  emailSubject?: string;
  emailActionUrl?: string;
  emailActionLabel?: string;
}) => {
  const startedAt = Date.now();

  try {
    console.info(`[WebNotification] Dispatch requested user=${userId} type=${type} title="${title}"`);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      console.warn(`[WebNotification] Skipped dispatch because user not found id=${userId}`);
      return;
    }

    console.info(`[WebNotification] Target resolved user=${user.id} email=${user.email}`);

    const notificationId = await createNotificationForUser({
      userId: user.id,
      title,
      message,
      type,
      entityType,
      entityId,
    });

    console.info(
      `[WebNotification] Channel=in-app status=sent user=${user.id} notificationId=${notificationId}`,
    );

    try {
      await sendNotificationEmail({
        to: user.email,
        subject: emailSubject || title,
        title,
        message,
        actionUrl: emailActionUrl,
        actionLabel: emailActionLabel,
      });

      console.info(
        `[WebNotification] Channel=email status=sent user=${user.id} to=${user.email} subject="${emailSubject || title}"`,
      );
    } catch (emailError) {
      console.error(
        `[WebNotification] Channel=email status=failed user=${user.id} to=${user.email}:`,
        emailError,
      );
    }

    console.info(
      `[WebNotification] Dispatch completed user=${user.id} type=${type} elapsedMs=${Date.now() - startedAt}`,
    );
  } catch (error) {
    console.error(`[WebNotification] Dispatch failed user=${userId} type=${type}:`, error);
  }
};

export const getNotificationsForUser = async (userId: string, limit: number) => {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50;

  try {
    await ensureNotificationTable();

    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
      select: {
        id: true,
        userId: true,
        title: true,
        message: true,
        type: true,
        entityType: true,
        entityId: true,
        isRead: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error: any) {
    console.error("[WebNotification] getNotificationsForUser failed, returning empty list:", error?.message || error);
    return [];
  }
};

export const markNotificationRead = async (userId: string, notificationId: string) => {
  try {
    await ensureNotificationTable();

    const result = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return result.count;
  } catch (error: any) {
    console.error("[WebNotification] markNotificationRead failed:", error?.message || error);
    return 0;
  }
};

export const markAllNotificationsRead = async (userId: string) => {
  try {
    await ensureNotificationTable();

    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return result.count;
  } catch (error: any) {
    console.error("[WebNotification] markAllNotificationsRead failed:", error?.message || error);
    return 0;
  }
};
