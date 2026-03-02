import { Role } from '@prisma/client';
import type { Request } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';

export type RequestWithUser = Request & { user?: { id: string; role: Role } };

export const createReviewSchema = z
  .object({
    revieweeId: z.union([z.string().min(1), z.number()]).transform((value) => String(value)),
    comments: z.string().optional(),
    summary: z.string().optional(),
    score: z.number().int().optional(),
    goalIds: z.array(z.union([z.string().min(1), z.number()]).transform((value) => String(value))).default([]),
    month: z.string().optional(),
    managerFeedback: z.string().optional(),
    completedTaskIds: z.array(z.union([z.number(), z.string()])).optional(),
    pendingTaskIds: z.array(z.union([z.number(), z.string()])).optional(),
    roleGoalProgress: z
      .array(z.object({ goalId: z.union([z.number(), z.string()]), progress: z.number().int().min(0).max(100) }))
      .optional(),
    monthlyTaskCategoryDistribution: z.record(z.number().int()).optional()
  })
  .refine((data) => Boolean(data.summary || data.managerFeedback), {
    message: 'summary or managerFeedback is required',
    path: ['summary']
  });

export const listReviewSchema = z.object({
  revieweeId: z.union([z.string(), z.number()]).transform((value) => String(value)).optional(),
  reviewerId: z.union([z.string(), z.number()]).transform((value) => String(value)).optional(),
  userId: z.union([z.string(), z.number()]).transform((value) => String(value)).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const reviewIdParamSchema = z.object({
  id: z.string().min(1)
});

export const reviewSummarySchema = z.object({
  userId: z.string().optional()
});

export async function isSubordinate(managerId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.managerId === managerId;
}
