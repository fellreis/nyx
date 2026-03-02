import crypto from 'node:crypto';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { parseDurationToMs, signAccessToken } from '../../utils/token.js';
import { ENV } from '../../config/env.js';
import { uiRoleSchema } from '../../lib/ui-mapper.js';

export const registerSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(1),
    password: z.string().min(6),
    role: uiRoleSchema.optional(),
    managerId: z
      .union([z.string(), z.number(), z.null()])
      .transform((value) => (value === null || value === undefined ? value : String(value)))
      .optional(),
    department: z.string().optional(),
    roleTemplateId: z.number().int().nullable().optional(),
    progressHistory: z.array(z.object({ date: z.string(), score: z.number().int(), tasksCompleted: z.number().int() })).optional()
  })
  .superRefine((data, ctx) => {
    const role = data.role ?? Role.USER;
    if (role !== Role.ADMIN && !data.managerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['managerId'],
        message: 'managerId is required for non-admin users'
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).optional()
});

export const logoutSchema = refreshSchema;

export function buildUserResponse(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  managerId: string | null;
  department?: string | null;
  roleTemplateId?: number | null;
  progressHistory?: unknown;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    managerId: user.managerId,
    department: user.department ?? null,
    roleTemplateId: user.roleTemplateId ?? null,
    progressHistory: user.progressHistory ?? []
  };
}

export function refreshExpiresAt() {
  const ms = parseDurationToMs(ENV.JWT_REFRESH_EXPIRES_IN || '7d');
  const fallback = 1000 * 60 * 60 * 24 * 7;
  return new Date(Date.now() + (ms || fallback));
}

export function extractSessionMetadata(req: Request) {
  return {
    userAgent: req.get('user-agent') ?? null,
    ip: req.ip ?? null
  };
}

export function buildSessionData(userId: string, metadata: { userAgent: string | null; ip: string | null }) {
  return {
    userId,
    token: crypto.randomUUID(),
    expiresAt: refreshExpiresAt(),
    userAgent: metadata.userAgent,
    ip: metadata.ip
  };
}

export async function createSession(userId: string, metadata: { userAgent: string | null; ip: string | null }) {
  return prisma.session.create({
    data: buildSessionData(userId, metadata)
  });
}

export function signUserAccessToken(user: { id: string; role: Role }) {
  return signAccessToken(user);
}
