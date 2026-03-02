import { Router, type Request, type Response } from 'express';
import { GoalStatus, GoalType, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middlewares/auth.js';
import { userIdParamSchema } from './shared.js';
import { mapGoalStatsToUi, mapGoalToUi, mapReviewToUi, mapUserToUi } from '../../lib/ui-mapper.js';

const getUser = Router();

getUser.get('/users/:id', authenticate, async (req: Request, res: Response) => {
  const request = req as Request & { user?: { id: string; role: Role } };
  const parsedParams = userIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid params', details: parsedParams.error.flatten() });
  }

  const userId = parsedParams.data.id;
  const current = request.user;

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

  if (!current) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (current.role === Role.USER && current.id !== user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (current.role === Role.MANAGER && user.managerId !== current.id) {
    return res.status(403).json({ error: 'Managers can only view their subordinates' });
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

export { getUser };
