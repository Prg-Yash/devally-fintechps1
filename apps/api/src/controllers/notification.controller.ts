import { Request, Response } from 'express';
import {
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from '../config/notification-service';

export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const userId = String(req.query.userId || '');
    const limit = Number(req.query.limit || 50);

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const notifications = await getNotificationsForUser(userId, limit);
    const unreadCount = notifications.filter((item) => !item.isRead).length;

    return res.json({ count: notifications.length, unreadCount, notifications });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const setNotificationRead = async (req: Request, res: Response) => {
  try {
    const notificationId = Array.isArray(req.params.notificationId)
      ? req.params.notificationId[0]
      : req.params.notificationId;
    const userId = String(req.body?.userId || '');

    if (!notificationId || !userId) {
      return res.status(400).json({ error: 'notificationId and userId are required' });
    }

    const updatedCount = await markNotificationRead(userId, notificationId);

    return res.json({
      message: updatedCount ? 'Notification marked as read' : 'No matching notification found',
      updatedCount,
    });
  } catch (error: any) {
    console.error('Error updating notification read status:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};

export const setAllNotificationsRead = async (req: Request, res: Response) => {
  try {
    const userId = String(req.body?.userId || '');

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const updatedCount = await markAllNotificationsRead(userId);

    return res.json({
      message: 'Notifications marked as read',
      updatedCount,
    });
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
};
