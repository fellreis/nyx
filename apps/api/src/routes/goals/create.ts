import { Router, type Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { RequestWithUser, createGoalSchema, ensureGoalExists, getUser, isSubordinate } from './shared.js';
import { buildGoalMeta, mapGoalStatusFromUi, mapGoalToUi, uiGoalStatusValues } from '../../lib/ui-mapper.js';

const createGoal = Router();

createGoal.post('/goals', authenticate, requireRole(Role.ADMIN, Role.MANAGER), async (req: RequestWithUser, res: Response) => {
  const parsed = createGoalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const {
    title,
    description,
    type,
    role,
    points,
    dependsOnId,
    assignedToId,
    status,
    progress,
    deadline,
    subtasks,
    dependencies,
    category,
    reviewPeriod,
    isPromotionBlocker
  } = parsed.data;

  const assignedUser = await getUser(assignedToId);
  if (!assignedUser) {
    return res.status(400).json({ error: 'assignedToId must reference an existing user' });
  }

  if (req.user?.role === Role.MANAGER && !(await isSubordinate(req.user.id, assignedToId))) {
    return res.status(403).json({ error: 'Managers can only assign goals to their subordinates' });
  }

  const resolvedDependsOnId =
    dependsOnId ?? (dependencies && dependencies.length ? String(dependencies[0]) : undefined);

  if (resolvedDependsOnId) {
    const dependsOn = await ensureGoalExists(resolvedDependsOnId);
    if (!dependsOn) {
      return res.status(400).json({ error: 'dependsOnId must reference an existing goal' });
    }
  }

  const uiStatus = typeof status === 'string' && uiGoalStatusValues.includes(status as any) ? (status as any) : undefined;
  const storedStatus = status ? mapGoalStatusFromUi(status) : undefined;
  const meta = buildGoalMeta({
    progress,
    deadline,
    subtasks,
    dependencies,
    category,
    reviewPeriod,
    isPromotionBlocker,
    uiStatus
  });

  const goal = await prisma.goal.create({
    data: {
      title,
      description,
      type,
      role,
      points,
      dependsOnId: resolvedDependsOnId ?? null,
      assignedToId,
      createdById: req.user?.id ?? assignedToId,
      status: storedStatus,
      meta
    }
  });

  return res.status(201).json({ goal: mapGoalToUi(goal) });
});

export { createGoal };
