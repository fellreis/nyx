import type { Request } from 'express';
import { z } from 'zod';

export type RequestWithUser = Request & { user?: { id: string } };

export const listNotificationsSchema = z.object({
  unread: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const notificationIdParamSchema = z.object({
  id: z.string().min(1)
});
