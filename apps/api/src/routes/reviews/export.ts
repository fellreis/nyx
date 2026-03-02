import fs from 'node:fs/promises';
import path from 'node:path';
import { Router, type Response } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middlewares/auth.js';
import { sendEmailStub } from '../../utils/email.js';
import { RequestWithUser, reviewIdParamSchema } from './shared.js';

const exportReview = Router();

exportReview.post('/reviews/:id/export', authenticate, async (req: RequestWithUser, res: Response) => {
  const parsedParams = reviewIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'Invalid params', details: parsedParams.error.flatten() });
  }

  const reviewId = parsedParams.data.id;

  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { reviewee: true, reviewer: true, goals: { select: { goalId: true } } }
  });

  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }

  if (req.user.role === Role.MANAGER && review.reviewee.managerId !== req.user.id && review.reviewerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (req.user.role === Role.USER && review.revieweeId !== req.user.id && review.reviewerId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const reportHtml = `<!doctype html>
<html><body>
  <h1>Review ${review.id}</h1>
  <p><strong>Reviewer:</strong> ${review.reviewer.name} (${review.reviewer.email})</p>
  <p><strong>Reviewee:</strong> ${review.reviewee.name} (${review.reviewee.email})</p>
  <p><strong>Summary:</strong> ${review.summary}</p>
  <p><strong>Comments:</strong> ${review.comments ?? '-'}</p>
  <p><strong>Score:</strong> ${review.score ?? '-'}</p>
  <p><strong>Goals:</strong> ${(review.goals ?? []).map((g) => g.goalId).join(', ') || 'None'}</p>
</body></html>`;

  const exportPath = path.posix.join('tmp', 'exports', `review-${review.id}.html`);
  const exportDir = path.join(process.cwd(), 'tmp', 'exports');
  await fs.mkdir(exportDir, { recursive: true });
  const filePath = path.join(process.cwd(), ...exportPath.split('/'));
  await fs.writeFile(filePath, reportHtml, 'utf8');

  await sendEmailStub(review.reviewee.email, 'Review export disponível', `Link interno: ${filePath}`);

  return res.json({ exportPath });
});

export { exportReview };
