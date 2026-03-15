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

const NEXT_NOTIFICATIONS_BASE_URL = process.env.NOTIFICATION_API_BASE_URL || 'http://localhost:3000/api/notifications';
const NOTIFICATION_API_SECRET = process.env.NOTIFICATION_API_SECRET || '';

const buildHeaders = () => {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};

	if (NOTIFICATION_API_SECRET) {
		headers['x-notification-secret'] = NOTIFICATION_API_SECRET;
	}

	return headers;
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
	const response = await fetch(NEXT_NOTIFICATIONS_BASE_URL, {
		method: 'POST',
		headers: buildHeaders(),
		body: JSON.stringify({ userId, title, message, type, entityType, entityId }),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Notification create failed (${response.status}): ${text}`);
	}

	return null;
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
		const response = await fetch(NEXT_NOTIFICATIONS_BASE_URL, {
			method: 'POST',
			headers: buildHeaders(),
			body: JSON.stringify({
				userId,
				title,
				message,
				type,
				entityType,
				entityId,
				emailSubject,
			}),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Notification dispatch failed (${response.status}): ${text}`);
		}
	} catch (error) {
		console.error('Notification proxy dispatch failed:', error);
	}
};

export const getNotificationsForUser = async (userId: string, limit: number) => {
	const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50;
	const response = await fetch(
		`${NEXT_NOTIFICATIONS_BASE_URL}?userId=${encodeURIComponent(userId)}&limit=${safeLimit}`,
		{
			method: 'GET',
			headers: buildHeaders(),
		},
	);

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Notification fetch failed (${response.status}): ${text}`);
	}

	const data = (await response.json()) as { notifications?: NotificationRow[] };
	return Array.isArray(data?.notifications) ? (data.notifications as NotificationRow[]) : [];
};

export const markNotificationRead = async (userId: string, notificationId: string) => {
	const response = await fetch(`${NEXT_NOTIFICATIONS_BASE_URL}/${notificationId}/read`, {
		method: 'PATCH',
		headers: buildHeaders(),
		body: JSON.stringify({ userId }),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Notification read update failed (${response.status}): ${text}`);
	}

	const data = (await response.json()) as { updatedCount?: number };
	return Number(data?.updatedCount || 0);
};

export const markAllNotificationsRead = async (userId: string) => {
	const response = await fetch(`${NEXT_NOTIFICATIONS_BASE_URL}/read-all`, {
		method: 'PATCH',
		headers: buildHeaders(),
		body: JSON.stringify({ userId }),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Notification read-all update failed (${response.status}): ${text}`);
	}

	const data = (await response.json()) as { updatedCount?: number };
	return Number(data?.updatedCount || 0);
};
