import { Router, type Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middlewares/auth.js';
import { RequestWithUser, isSubordinate, reviewSummarySchema } from './shared.js';

const reviewSummary = Router();

reviewSummary.get('/reviews/summary', authenticate, async (req: RequestWithUser, res: Response) => {
  const parsed = reviewSummarySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const { userId } = parsed.data;

  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (req.user.role === Role.USER && userId && userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.user.role === Role.MANAGER && userId && !(await isSubordinate(req.user.id, userId))) {
    return res.status(403).json({ error: 'Managers can only view summaries of subordinates' });
  }

  const resolvedUser = userId ?? (req.user.role === Role.ADMIN ? undefined : req.user.id);

  const byReviewee = await prisma.review.groupBy({
    by: ['revieweeId'],
    _count: { _all: true },
    where: resolvedUser ? { revieweeId: resolvedUser } : undefined
  });

  const byReviewer = await prisma.review.groupBy({
    by: ['reviewerId'],
    _count: { _all: true },
    where: resolvedUser ? { reviewerId: resolvedUser } : undefined
  });

  return res.json({
    received: byReviewee.reduce((acc, curr) => acc + curr._count._all, 0),
    given: byReviewer.reduce((acc, curr) => acc + curr._count._all, 0)
  });
});

export { reviewSummary };
