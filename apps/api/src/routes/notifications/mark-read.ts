import { Router, type Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middlewares/auth.js';
import { notificationIdParamSchema, RequestWithUser } from './shared.js';
import { mapNotificationToUi } from '../../lib/ui-mapper.js';

const markNotificationRead = Router();

markNotificationRead.post('/notifications/:id/read', authenticate, async (req: RequestWithUser, res: Response) => {
  const parsedParams = notificationIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid params', details: parsedParams.error.flatten() });
  }

  const notificationId = parsedParams.data.id;

  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.userId !== req.user?.id) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: new Date() }
  });

  return res.json({ notification: mapNotificationToUi(updated) });
});

export { markNotificationRead };
