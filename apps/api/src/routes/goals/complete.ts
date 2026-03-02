import { Router, type Response } from 'express';
import { GoalStatus, GoalType, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middlewares/auth.js';
import { RequestWithUser, completeGoalSchema, ensureGoalExists, goalIdParamSchema, isSubordinate } from './shared.js';
import { buildGoalMeta, mapGoalToUi } from '../../lib/ui-mapper.js';

const completeGoal = Router();

completeGoal.post('/goals/:id/complete', authenticate, async (req: RequestWithUser, res: Response) => {
  const parsedParams = goalIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid params', details: parsedParams.error.flatten() });
  }

  const goalId = parsedParams.data.id;

  const parsed = completeGoalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) {
    return res.status(404).json({ error: 'Goal not found' });
  }

  if (req.user?.role === Role.USER && goal.assignedToId !== req.user?.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.user?.role === Role.MANAGER && !(await isSubordinate(req.user.id, goal.assignedToId))) {
    return res.status(403).json({ error: 'Managers can only complete goals of their subordinates' });
  }

  if (goal.type === GoalType.MONTHLY && req.user?.role === Role.USER) {
    return res.status(403).json({ error: 'Monthly goals can only be completed by managers/admins' });
  }

  if (goal.dependsOnId && parsed.data.done) {
    const dependency = await ensureGoalExists(goal.dependsOnId);
    if (dependency && dependency.status !== GoalStatus.DONE) {
      return res.status(400).json({ error: 'Goal depends on another goal that is not completed yet' });
    }
  }

  const done = parsed.data.done;
  const meta = buildGoalMeta(
    {
      progress: done ? 100 : 0,
      uiStatus: done ? 'Completed' : 'Not Started'
    },
    (goal as any).meta
  );

  const updated = await prisma.goal.update({
    where: { id: goal.id },
    data: {
      status: done ? GoalStatus.DONE : GoalStatus.PENDING,
      doneAt: done ? new Date() : null,
      meta
    }
  });

  if (done && goal.createdById) {
    await prisma.notification.create({
      data: {
        userId: goal.createdById,
        message: `Goal "${goal.title}" marked as done`,
        meta: { goalId: goal.id, status: updated.status }
      }
    });
  }

  return res.json({ goal: mapGoalToUi(updated) });
});

export { completeGoal };
