import { Router, type Request, type Response } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { hashPassword } from '../../utils/password.js';
import { userIdParamSchema } from './shared.js';

const updatePasswordSchema = z.object({
  password: z.string().min(6)
});

const patchUserPassword = Router();

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

export { patchUserPassword };
