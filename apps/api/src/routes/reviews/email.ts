import { Router, type Response } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middlewares/auth.js';
import { sendEmail } from '../../utils/email.js';
import type { RequestWithUser } from './shared.js';

const emailReview = Router();

const MAX_BASE64_SIZE = 2 * 1024 * 1024; // ~2MB max attachment

const emailReviewSchema = z.object({
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1).max(200),
  text: z.string().min(1).max(10000),
  filename: z.string().min(1).max(255),
  contentBase64: z.string().min(1).max(MAX_BASE64_SIZE, 'Attachment exceeds 2MB limit')
});

emailReview.post('/reviews/email', authenticate, requireRole(Role.ADMIN, Role.MANAGER), async (req: RequestWithUser, res: Response) => {
  const parsed = emailReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const { to, subject, text, filename, contentBase64 } = parsed.data;

  await sendEmail({
    to,
    subject,
    text,
    attachments: [
      {
        filename,
        content: contentBase64,
        type: 'application/pdf'
      }
    ]
  });

  return res.status(204).send();
});

export { emailReview };
