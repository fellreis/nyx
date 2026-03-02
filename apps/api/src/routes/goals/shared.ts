import { GoalStatus, GoalType, Role } from '@prisma/client';
import type { Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { uiGoalStatusInputSchema, uiGoalStatusSchema, uiGoalTypeSchema, uiRoleSchema } from '../../lib/ui-mapper.js';

export type RequestWithUser = Request & { user?: { id: string; role: Role } };

export const goalIdParamSchema = z.object({
  id: z.string().min(1)
});

export const pointsSchema = z.number().int().positive();

export const createGoalSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: uiGoalTypeSchema,
  role: uiRoleSchema.optional(),
  points: pointsSchema,
  dependsOnId: z.string().optional(),
  assignedToId: z.union([z.string().min(1), z.number()]).transform((value) => String(value)),
  status: uiGoalStatusInputSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  deadline: z.string().optional(),
  subtasks: z.array(z.object({ id: z.union([z.number(), z.string()]), title: z.string().min(1), completed: z.boolean() })).optional(),
  dependencies: z.array(z.union([z.number(), z.string()])).optional(),
  category: z.string().optional(),
  reviewPeriod: z.string().optional(),
  isPromotionBlocker: z.boolean().optional()
});

export const updateGoalSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  type: uiGoalTypeSchema.optional(),
  role: uiRoleSchema.optional(),
  points: pointsSchema.optional(),
  dependsOnId: z.string().optional().nullable(),
  assignedToId: z.union([z.string().min(1), z.number()]).transform((value) => String(value)).optional(),
  status: uiGoalStatusInputSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  deadline: z.string().optional(),
  subtasks: z.array(z.object({ id: z.union([z.number(), z.string()]), title: z.string().min(1), completed: z.boolean() })).optional(),
  dependencies: z.array(z.union([z.number(), z.string()])).optional(),
  category: z.string().optional(),
  reviewPeriod: z.string().optional(),
  isPromotionBlocker: z.boolean().optional()
});

export const completeGoalSchema = z.object({
  done: z.boolean()
});

export const listGoalsSchema = z.object({
  type: uiGoalTypeSchema.optional(),
  role: uiRoleSchema.optional(),
  status: uiGoalStatusSchema.optional(),
  assignedToId: z.union([z.string(), z.number()]).transform((value) => String(value)).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export async function getUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function ensureUserExists(userId: string) {
  const user = await getUser(userId);
  return Boolean(user);
}

export async function ensureGoalExists(goalId: string) {
  return prisma.goal.findUnique({ where: { id: goalId } });
}

export async function isSubordinate(managerId: string, userId: string) {
  const user = await getUser(userId);
  return user?.managerId === managerId;
}
