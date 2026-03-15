import { randomUUID } from 'crypto';
import prisma from './prisma';
import { sendNotificationEmail } from './mailer';

export type NotificationType = 'AGREEMENT' | 'TICKET' | 'PURCHASE';

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

let tableReady = false;

const ensureNotificationTable = async () => {
  if (tableReady) {
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
    'CREATE INDEX IF NOT EXISTS "notification_userId_createdAt_idx" ON "notification" ("userId", "createdAt" DESC);'
  );

  tableReady = true;
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

  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "notification" ("id", "userId", "title", "message", "type", "entityType", "entityId")
    VALUES (${id}, ${userId}, ${title}, ${message}, ${type}, ${entityType ?? null}, ${entityId ?? null})
  `;

  return id;
};

export const notifyUser = async ({
  userId,
  title,
  message,
  type,
  entityType,
  entityId,
  emailSubject,
}: {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  entityType?: string;
  entityId?: string;
  emailSubject?: string;
}) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return;
    }

    await createNotificationForUser({
      userId: user.id,
      title,
      message,
      type,
      entityType,
      entityId,
    });

    await sendNotificationEmail({
      to: user.email,
      subject: emailSubject || title,
      title,
      message,
    });
  } catch (error) {
    console.error('Notification dispatch failed:', error);
  }
};

export const getNotificationsForUser = async (userId: string, limit: number) => {
  await ensureNotificationTable();

  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50;

  return prisma.$queryRaw<NotificationRow[]>`
    SELECT "id", "userId", "title", "message", "type", "entityType", "entityId", "isRead", "createdAt", "updatedAt"
    FROM "notification"
    WHERE "userId" = ${userId}
    ORDER BY "createdAt" DESC
    LIMIT ${safeLimit}
  `;
};

export const markNotificationRead = async (userId: string, notificationId: string) => {
  await ensureNotificationTable();

  return prisma.$executeRaw`
    UPDATE "notification"
    SET "isRead" = true, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${notificationId} AND "userId" = ${userId}
  `;
};

export const markAllNotificationsRead = async (userId: string) => {
  await ensureNotificationTable();

  return prisma.$executeRaw`
    UPDATE "notification"
    SET "isRead" = true, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = ${userId} AND "isRead" = false
  `;
};
