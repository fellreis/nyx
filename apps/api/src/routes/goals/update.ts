import { Router, type Response } from 'express';
import { GoalStatus, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { RequestWithUser, ensureGoalExists, ensureUserExists, goalIdParamSchema, isSubordinate, updateGoalSchema } from './shared.js';
import { buildGoalMeta, mapGoalStatusFromUi, mapGoalToUi, uiGoalStatusValues } from '../../lib/ui-mapper.js';

const updateGoal = Router();

updateGoal.patch('/goals/:id', authenticate, requireRole(Role.ADMIN, Role.MANAGER), async (req: RequestWithUser, res: Response) => {
  const parsedParams = goalIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid params', details: parsedParams.error.flatten() });
  }

  const goalId = parsedParams.data.id;

  const parsed = updateGoalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const goal = await ensureGoalExists(goalId);
  if (!goal) {
    return res.status(404).json({ error: 'Goal not found' });
  }

  if (req.user?.role === Role.MANAGER && !(await isSubordinate(req.user.id, goal.assignedToId))) {
    return res.status(403).json({ error: 'Managers can only update goals of their subordinates' });
  }

  const {
    dependsOnId,
    assignedToId,
    status,
    progress,
    deadline,
    subtasks,
    dependencies,
    category,
    reviewPeriod,
    isPromotionBlocker,
    ...rest
  } = parsed.data;

  if (assignedToId && !(await ensureUserExists(assignedToId))) {
    return res.status(400).json({ error: 'assignedToId must reference an existing user' });
  }

  const resolvedDependsOnId =
    dependsOnId !== undefined ? dependsOnId : dependencies && dependencies.length ? String(dependencies[0]) : undefined;

  if (resolvedDependsOnId !== undefined) {
    if (resolvedDependsOnId === goal.id) {
      return res.status(400).json({ error: 'Goal cannot depend on itself' });
    }
    if (resolvedDependsOnId) {
      const dependsOn = await ensureGoalExists(resolvedDependsOnId);
      if (!dependsOn) {
        return res.status(400).json({ error: 'dependsOnId must reference an existing goal' });
      }
    }
  }

  const uiStatus = typeof status === 'string' && uiGoalStatusValues.includes(status as any) ? (status as any) : undefined;
  const storedStatus = status ? mapGoalStatusFromUi(status) : undefined;

  const statusData =
    storedStatus === GoalStatus.DONE
      ? { status: storedStatus, doneAt: goal.doneAt ?? new Date() }
      : storedStatus === GoalStatus.PENDING
        ? { status: storedStatus, doneAt: null }
        : {};

  const meta = buildGoalMeta(
    {
      progress,
      deadline,
      subtasks,
      dependencies,
      category,
      reviewPeriod,
      isPromotionBlocker,
      uiStatus
    },
    (goal as any).meta
  );

  const updated = await prisma.goal.update({
    where: { id: goal.id },
    data: {
      ...rest,
      dependsOnId: resolvedDependsOnId ?? null,
      assignedToId: assignedToId ?? goal.assignedToId,
      ...statusData,
      meta
    }
  });

  return res.json({ goal: mapGoalToUi(updated) });
});

export { updateGoal };
