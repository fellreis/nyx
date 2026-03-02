import { Router, type Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middlewares/auth.js';
import { listNotificationsSchema, RequestWithUser } from './shared.js';
import { mapNotificationToUi } from '../../lib/ui-mapper.js';

const listNotifications = Router();

listNotifications.get('/notifications', authenticate, async (req: RequestWithUser, res: Response) => {
  const parsed = listNotificationsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const { unread, page, limit } = parsed.data;
  const where = {
    userId: req.user?.id ?? '',
    ...(unread !== undefined ? (unread ? { readAt: null } : {}) : {})
  };

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.notification.count({ where })
  ]);

  return res.json({
    items: items.map((item) => mapNotificationToUi(item)),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  });
});

export { listNotifications };
