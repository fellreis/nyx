import { Router, type Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { RequestWithUser, createReviewSchema, isSubordinate } from './shared.js';
import { buildReviewMeta, mapReviewToUi } from '../../lib/ui-mapper.js';

const createReview = Router();

createReview.post('/reviews', authenticate, requireRole(Role.ADMIN, Role.MANAGER), async (req: RequestWithUser, res: Response) => {
  const parsed = createReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const {
    revieweeId,
    comments,
    summary,
    score,
    goalIds,
    month,
    managerFeedback,
    completedTaskIds,
    pendingTaskIds,
    roleGoalProgress,
    monthlyTaskCategoryDistribution
  } = parsed.data;

  const reviewee = await prisma.user.findUnique({ where: { id: revieweeId } });
  if (!reviewee) {
    return res.status(400).json({ error: 'revieweeId must reference an existing user' });
  }

  if (req.user?.role === Role.MANAGER && !(await isSubordinate(req.user.id, revieweeId))) {
    return res.status(403).json({ error: 'Managers can only review their subordinates' });
  }

  if (goalIds.length) {
    const goals = await prisma.goal.findMany({ where: { id: { in: goalIds } }, select: { id: true, assignedToId: true } });
    if (goals.length !== goalIds.length) {
      return res.status(400).json({ error: 'All goalIds must reference existing goals' });
    }
    const invalidGoal = goals.find((g) => g.assignedToId !== revieweeId);
    if (invalidGoal) {
      return res.status(400).json({ error: 'All goalIds must belong to the reviewee' });
    }
  }

  const resolvedSummary = summary ?? managerFeedback ?? '';
  const meta = buildReviewMeta({
    month,
    managerFeedback,
    completedTaskIds,
    pendingTaskIds,
    roleGoalProgress,
    monthlyTaskCategoryDistribution
  });

  const review = await prisma.review.create({
    data: {
      reviewerId: req.user?.id ?? '',
      revieweeId,
      comments,
      summary: resolvedSummary,
      score,
      meta
    },
    include: {
      goals: true
    }
  });

  if (goalIds.length) {
    await prisma.reviewGoal.createMany({
      data: goalIds.map((goalId) => ({ reviewId: review.id, goalId })),
      skipDuplicates: true
    });
  }

  await prisma.notification.create({
    data: {
      userId: revieweeId,
      message: `Your performance report for ${new Date((month ?? new Date().toISOString().slice(0, 7)) + '-02').toLocaleString('default', {
        month: 'long',
        timeZone: 'UTC'
      })} is now available.`,
      meta: { type: 'review', reviewId: review.id }
    }
  });


  const fullReview = await prisma.review.findUnique({
    where: { id: review.id },
    include: { goals: { select: { goalId: true } } }
  });

  return res.status(201).json({ review: mapReviewToUi(fullReview as any) });
});

export { createReview };
