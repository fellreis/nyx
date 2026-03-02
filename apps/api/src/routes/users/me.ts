import { Router, type Request, type Response } from 'express';
import { GoalStatus, GoalType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middlewares/auth.js';
import { mapGoalStatsToUi, mapGoalToUi, mapReviewToUi, mapUserToUi } from '../../lib/ui-mapper.js';

const getMe = Router();

getMe.get('/users/me', authenticate, async (req: Request, res: Response) => {
  const request = req as Request & { user?: { id: string } };
  const userId = request.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      managerId: true,
      department: true,
      roleTemplateId: true,
      progressHistory: true,
      manager: { select: { id: true, name: true, email: true } },
      createdAt: true,
      updatedAt: true
    }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const [reviewsReceived, reviewsGiven, statusGroups, typeGroups, totalPoints, completedPoints, goals, reviews] = await Promise.all([
    prisma.review.count({ where: { revieweeId: userId } }),
    prisma.review.count({ where: { reviewerId: userId } }),
    prisma.goal.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: { assignedToId: userId }
    }),
    prisma.goal.groupBy({
      by: ['type'],
      _count: { _all: true },
      where: { assignedToId: userId }
    }),
    prisma.goal.aggregate({
      where: { assignedToId: userId },
      _sum: { points: true }
    }),
    prisma.goal.aggregate({
      where: { assignedToId: userId, status: GoalStatus.DONE },
      _sum: { points: true }
    }),
    prisma.goal.findMany({ where: { assignedToId: userId } }),
    prisma.review.findMany({ where: { revieweeId: userId } })
  ]);

  const byStatus: Record<GoalStatus, number> = {
    [GoalStatus.PENDING]: 0,
    [GoalStatus.DONE]: 0
  };

  statusGroups.forEach((group) => {
    byStatus[group.status] = group._count._all;
  });

  const byType: Record<GoalType, number> = {
    [GoalType.BASIC]: 0,
    [GoalType.MONTHLY]: 0,
    [GoalType.ROLE]: 0
  };

  typeGroups.forEach((group) => {
    byType[group.type] = group._count._all;
  });

  const totalGoals = Object.values(byStatus).reduce((acc, curr) => acc + curr, 0);

  const stats = {
    reviews: {
      received: reviewsReceived,
      given: reviewsGiven
    },
    goals: {
      total: totalGoals,
      byStatus,
      byType,
      points: {
        total: totalPoints._sum.points ?? 0,
        completed: completedPoints._sum.points ?? 0
      }
    }
  };

  const responseUser = mapUserToUi({
    ...user,
    goals: goals.map((goal) => mapGoalToUi(goal as any)),
    reviews: reviews.map((review) => mapReviewToUi(review as any)),
    progressHistory: user.progressHistory ?? []
  } as any);

  return res.json({
    user: responseUser,
    stats: mapGoalStatsToUi(stats)
  });
});

export { getMe };
