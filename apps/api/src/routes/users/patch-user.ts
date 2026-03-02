import { Router, type Request, type Response } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { userIdParamSchema } from './shared.js';
import { mapUserToUi, uiRoleSchema } from '../../lib/ui-mapper.js';

const patchUserSchema = z
  .object({
    role: uiRoleSchema.optional(),
    managerId: z
      .union([z.string(), z.number()])
      .nullable()
      .optional()
      .transform((value) => (value === null || value === undefined ? value : String(value))),
    isActive: z.boolean().optional(),
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    department: z.string().optional(),
    roleTemplateId: z.number().int().nullable().optional(),
    progressHistory: z.array(z.object({ date: z.string(), score: z.number().int(), tasksCompleted: z.number().int() })).optional()
  })
  .refine(
    (data) =>
      data.role !== undefined ||
      data.managerId !== undefined ||
      data.isActive !== undefined ||
      data.name !== undefined ||
      data.email !== undefined ||
      data.department !== undefined ||
      data.roleTemplateId !== undefined ||
      data.progressHistory !== undefined,
    {
      message: 'At least one field must be provided'
    }
  );

const patchUser = Router();

patchUser.patch('/users/:id', authenticate, requireRole(Role.ADMIN), async (req: Request, res: Response) => {
  const parsedParams = userIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid params', details: parsedParams.error.flatten() });
  }

  const parsed = patchUserSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const user = await prisma.user.findUnique({
    where: { id: parsedParams.data.id },
    select: {
      id: true,
      role: true,
      managerId: true,
      isActive: true
    }
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { role, managerId, isActive, name, email, department, roleTemplateId, progressHistory } = parsed.data;
  const nextRole = role ?? user.role;
  const data: Record<string, unknown> = {};

  if (role) {
    data.role = role;
  }

  if (managerId !== undefined) {
    if (managerId === null) {
      if (nextRole !== Role.ADMIN) {
        return res.status(400).json({ error: 'Non-admin users must have a manager' });
      }
      data.managerId = null;
    } else {
      if (managerId === user.id) {
        return res.status(400).json({ error: 'User cannot be their own manager' });
      }
      const manager = await prisma.user.findUnique({ where: { id: managerId } });
      if (!manager) {
        return res.status(400).json({ error: 'managerId must reference an existing user' });
      }
      if (manager.role === Role.USER) {
        return res.status(400).json({ error: 'managerId must reference an admin or manager' });
      }
      data.managerId = managerId;
    }
  } else if (nextRole !== Role.ADMIN && !user.managerId) {
    return res.status(400).json({ error: 'Non-admin users must have a manager' });
  }

  if (isActive !== undefined) {
    data.isActive = isActive;
  }

  if (name !== undefined) {
    data.name = name;
  }

  if (email !== undefined) {
    data.email = email;
  }

  if (department !== undefined) {
    data.department = department;
  }

  if (roleTemplateId !== undefined) {
    data.roleTemplateId = roleTemplateId ?? 1;
  }

  if (progressHistory !== undefined) {
    data.progressHistory = progressHistory;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
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
      updatedAt: true
    }
  });

  return res.json({ user: mapUserToUi(updated) });
});

export { patchUser };
