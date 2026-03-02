import { Router, type Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middlewares/auth.js';
import { RequestWithUser, isSubordinate, listReviewSchema } from './shared.js';
import { mapReviewToUi } from '../../lib/ui-mapper.js';

const listReviews = Router();

listReviews.get('/reviews', authenticate, async (req: RequestWithUser, res: Response) => {
  const parsed = listReviewSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const { revieweeId, reviewerId, userId, page, limit } = parsed.data;
  const where: Record<string, unknown> = {};
  const resolvedReviewee = revieweeId ?? userId;

  if (req.user?.role === Role.ADMIN) {
    if (resolvedReviewee) where.revieweeId = resolvedReviewee;
    if (reviewerId) where.reviewerId = reviewerId;
  } else if (req.user?.role === Role.MANAGER) {
    if (resolvedReviewee) {
      const allowed = await isSubordinate(req.user.id, resolvedReviewee);
      if (!allowed) {
        return res.status(403).json({ error: 'Managers can only view reviews of their subordinates' });
      }
      where.revieweeId = resolvedReviewee;
    } else {
      where.reviewee = { managerId: req.user.id };
    }

    if (reviewerId && reviewerId !== req.user.id) {
      return res
        .status(403)
        .json({ error: 'Managers can only view their own reviews or their subordinates as reviewee' });
    }
  } else {
    where.revieweeId = req.user?.id ?? '';
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { goals: { select: { goalId: true } } }
    }),
    prisma.review.count({ where })
  ]);

  return res.json({
    items: items.map((review) => mapReviewToUi(review as any)),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  });
});

export { listReviews };
