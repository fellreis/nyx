import { Router, type Request, type Response } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { mapGoalToUi, mapReviewToUi, mapUserToUi, uiRoleSchema } from '../../lib/ui-mapper.js';

const listUsersSchema = z.object({
  search: z.string().trim().optional(),
  role: uiRoleSchema.optional(),
  isActive: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
  managerId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

const listUsers = Router();

listUsers.get('/users', authenticate, requireRole(Role.ADMIN, Role.MANAGER), async (req: Request, res: Response) => {
  const request = req as Request & { user?: { id: string; role: Role } };
  const parsed = listUsersSchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const { search, role, isActive, managerId, page, limit } = parsed.data;
  const where: Record<string, unknown> = {
    ...(role ? { role } : {}),
    ...(isActive !== undefined ? { isActive } : {})
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (request.user?.role === Role.MANAGER) {
    where.managerId = request.user.id;
  } else if (managerId) {
    where.managerId = managerId;
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
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
        createdAt: true,
        updatedAt: true
      }
    }),
    prisma.user.count({ where })
  ]);

  const userIds = items.map((item) => item.id);
  const [goals, reviews] = await Promise.all([
    prisma.goal.findMany({ where: { assignedToId: { in: userIds } } }),
    prisma.review.findMany({ where: { revieweeId: { in: userIds } } })
  ]);

  const goalsByUser = new Map<string, any[]>();
  goals.forEach((goal) => {
    const list = goalsByUser.get(goal.assignedToId) ?? [];
    list.push(mapGoalToUi(goal as any));
    goalsByUser.set(goal.assignedToId, list);
  });

  const reviewsByUser = new Map<string, any[]>();
  reviews.forEach((review) => {
    const list = reviewsByUser.get(review.revieweeId) ?? [];
    list.push(mapReviewToUi(review as any));
    reviewsByUser.set(review.revieweeId, list);
  });

  const responseItems = items.map((item) =>
    mapUserToUi({
      ...item,
      goals: goalsByUser.get(item.id) ?? [],
      reviews: reviewsByUser.get(item.id) ?? [],
      progressHistory: item.progressHistory ?? []
    } as any)
  );
  return res.json({
    items: responseItems,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  });
});

export { listUsers };
