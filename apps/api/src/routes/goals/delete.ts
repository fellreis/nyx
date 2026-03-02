import { Router, type Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { RequestWithUser, goalIdParamSchema, isSubordinate } from './shared.js';

const deleteGoal = Router();

deleteGoal.delete('/goals/:id', authenticate, requireRole(Role.ADMIN, Role.MANAGER), async (req: RequestWithUser, res: Response) => {
  const parsedParams = goalIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid params', details: parsedParams.error.flatten() });
  }

  const goal = await prisma.goal.findUnique({ where: { id: parsedParams.data.id } });
  if (!goal) {
    return res.status(404).json({ error: 'Goal not found' });
  }

  if (req.user?.role === Role.MANAGER && !(await isSubordinate(req.user.id, goal.assignedToId))) {
    return res.status(403).json({ error: 'Managers can only delete goals of their subordinates' });
  }

  await prisma.goal.delete({ where: { id: goal.id } });
  return res.status(204).send();
});

export { deleteGoal };
