import dotenv from 'dotenv';
import prisma from '../config/prisma';
import {
  notifyUser,
  getNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
} from '../config/notification-service';

dotenv.config({ override: true });

type TestResult = {
  userId: string;
  email: string;
  createdNotificationId: string | null;
  fetchedCount: number;
  unreadCountBefore: number;
  markOneUpdatedCount: number;
  markAllUpdatedCount: number;
  unreadCountAfter: number;
};

const run = async () => {
  const preferredEmail = (process.env.TEST_NOTIFICATION_USER_EMAIL || '').trim().toLowerCase();

  const user = preferredEmail
    ? await prisma.user.findFirst({
        where: {
          email: {
            equals: preferredEmail,
            mode: 'insensitive',
          },
        },
        select: { id: true, email: true },
      })
    : await prisma.user.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true, email: true },
      });

  if (!user) {
    throw new Error('No user found in database. Create a user first or set TEST_NOTIFICATION_USER_EMAIL.');
  }

  console.log(`[NotificationTest] Using user ${user.email} (${user.id})`);

  const marker = `notif-test-${Date.now()}`;

  await notifyUser({
    userId: user.id,
    title: 'Test Agreement Notification',
    message: `Automated notification flow test marker=${marker}`,
    type: 'AGREEMENT',
    entityType: 'agreement',
    entityId: marker,
    emailSubject: 'Devally: Notification flow test',
  });

  const before = await getNotificationsForUser(user.id, 25);
  const unreadBefore = before.filter((item) => !item.isRead).length;
  const created = before.find((item) => item.entityId === marker) || null;

  if (!created) {
    throw new Error('Notification was not found after dispatch. Check Next.js notification API route availability.');
  }

  const markOneUpdated = await markNotificationRead(user.id, created.id);
  const markAllUpdated = await markAllNotificationsRead(user.id);

  const after = await getNotificationsForUser(user.id, 25);
  const unreadAfter = after.filter((item) => !item.isRead).length;

  const result: TestResult = {
    userId: user.id,
    email: user.email,
    createdNotificationId: created.id,
    fetchedCount: before.length,
    unreadCountBefore: unreadBefore,
    markOneUpdatedCount: Number(markOneUpdated || 0),
    markAllUpdatedCount: Number(markAllUpdated || 0),
    unreadCountAfter: unreadAfter,
  };

  console.log('[NotificationTest] Success');
  console.log(JSON.stringify(result, null, 2));
};

run()
  .catch((error) => {
    console.error('[NotificationTest] Failed:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
