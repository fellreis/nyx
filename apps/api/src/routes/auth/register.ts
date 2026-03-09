import { Router, type Request, type Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { registerRateLimiter } from '../../middlewares/rate-limit.js';
import { hashPassword } from '../../utils/password.js';
import { buildUserResponse, registerSchema } from './shared.js';
import { mapUserToUi } from '../../lib/ui-mapper.js';

const register = Router();

register.post('/auth/register', registerRateLimiter, authenticate, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  const request = req as Request & { user?: { id: string; role: Role } };
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const { email, name, password, role, managerId, department, roleTemplateId, progressHistory } = parsed.data;
  const resolvedRole = role ?? Role.USER;
  const resolvedRoleTemplateId = roleTemplateId ?? 1;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const manager = managerId ? await prisma.user.findUnique({ where: { id: managerId } }) : null;

  if (resolvedRole !== Role.ADMIN && !manager) {
    return res
      .status(400)
      .json({ error: 'managerId is required and must reference an existing user for non-admin roles' });
  }

  const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name,
          role: resolvedRole,
          managerId: manager ? manager.id : null,
          createdById: request.user?.id ?? null,
          passwordHash: await hashPassword(password),
          department: department ?? null,
          roleTemplateId: resolvedRoleTemplateId,
          progressHistory: progressHistory ?? []
        }
      });

    return created;
  });

  const responseUser = buildUserResponse(user);
  return res.status(201).json({ user: mapUserToUi(responseUser) });
});

export { register };
