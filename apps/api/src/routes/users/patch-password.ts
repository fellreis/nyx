import { Router, type Request, type Response } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { userIdParamSchema } from './shared.js';

const updatePasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters')
});

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
});

const patchUserPassword = Router();

// Admin: change any user's password
patchUserPassword.patch('/users/:id/password', authenticate, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  const parsedParams = userIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid params', details: parsedParams.error.flatten() });
  }

  const parsed = updatePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const user = await prisma.user.findUnique({ where: { id: parsedParams.data.id } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password) }
  });

  return res.status(204).send();
});

// Self-service: change own password (any authenticated user)
patchUserPassword.patch('/users/me/password', authenticate, async (req: Request, res: Response) => {
  const request = req as Request & { user?: { id: string; role: Role } };
  if (!request.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parsed = changeOwnPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const user = await prisma.user.findUnique({ where: { id: request.user.id } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) }
  });

  return res.status(204).send();
});

export { patchUserPassword };
