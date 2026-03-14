import { Router } from 'express';
import express from 'express';
import {
  getUserNotifications,
  setAllNotificationsRead,
  setNotificationRead,
} from '../controllers/notification.controller';

const router = Router();

router.get('/', getUserNotifications);
router.patch('/:notificationId/read', express.json(), setNotificationRead);
router.patch('/read-all', express.json(), setAllNotificationsRead);

export default router;
