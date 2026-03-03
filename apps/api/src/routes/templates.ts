import { Router, type Request, type Response } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { templates } from '../lib/templates.js';
import { buildDefaultGoals } from '../lib/default-goals.js';
import { prisma } from '../lib/prisma.js';

const templatesRouter = Router();

templatesRouter.get('/templates', authenticate, async (_req, res: Response) => {
  return res.json({ items: templates });
});

// Apply a template to a user (creates default goals)
templatesRouter.post('/templates/apply', authenticate, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  const request = req as Request & { user?: { id: string; role: Role } };
  const { userId, templateId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check template exists (currently only template 1)
  const template = templates.find(t => t.id === (templateId ?? 1));
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  // Build and create the goals
  const defaults = buildDefaultGoals(userId, request.user?.id ?? userId, user.role as Role);
  await prisma.goal.createMany({ data: defaults });

  // Count created goals
  const goalCount = await prisma.goal.count({ where: { assignedToId: userId } });

  return res.status(201).json({
    message: `Template "${template.name}" applied successfully`,
    goalsCreated: defaults.length,
    totalGoals: goalCount
  });
});

export { templatesRouter };
