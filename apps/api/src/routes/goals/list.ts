import { Router, type Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middlewares/auth.js';
import { RequestWithUser, isSubordinate, listGoalsSchema } from './shared.js';
import { mapGoalToUi } from '../../lib/ui-mapper.js';

const listGoals = Router();

listGoals.get('/goals', authenticate, async (req: RequestWithUser, res: Response) => {
  const parsed = listGoalsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
  }

  const { type, role, status, assignedToId, page, limit } = parsed.data;
  const where: Record<string, unknown> = {
    ...(type ? { type } : {}),
    ...(role ? { role } : {}),
    ...(status ? { status } : {})
  };

  if (req.user?.role === Role.USER) {
    where.assignedToId = req.user.id;
  } else if (req.user?.role === Role.MANAGER) {
    const targetAssigned = assignedToId ?? null;
    if (targetAssigned) {
      const allowed = await isSubordinate(req.user.id, targetAssigned);
      if (!allowed) {
        return res.status(403).json({ error: 'Managers can only view goals of their subordinates' });
      }
      where.assignedToId = targetAssigned;
    } else {
      where.assignedTo = { managerId: req.user.id };
    }
  } else if (assignedToId) {
    where.assignedToId = assignedToId;
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.goal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.goal.count({ where })
  ]);

  return res.json({
    items: items.map((item) => mapGoalToUi(item)),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  });
});

export { listGoals };
