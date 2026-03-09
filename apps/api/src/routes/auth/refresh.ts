import { Router, type Request, type Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { buildSessionData, extractSessionMetadata, refreshSchema, signUserAccessToken } from './shared.js';
import { mapUserToUi } from '../../lib/ui-mapper.js';
import { readRefreshCookie, setRefreshCookie } from '../../utils/cookies.js';
import { refreshRateLimiter } from '../../middlewares/rate-limit.js';

const refresh = Router();

refresh.post('/auth/refresh', refreshRateLimiter, async (req: Request, res: Response) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const refreshToken = parsed.data.refreshToken ?? readRefreshCookie(req);
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }
  const session = await prisma.session.findUnique({ where: { token: refreshToken } });

  if (!session) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const now = new Date();

  if (session.expiresAt <= now) {
    await prisma.session.delete({ where: { id: session.id } });
    return res.status(401).json({ error: 'Refresh token expired' });
  }

  if (session.rotatedAt) {
    return res.status(401).json({ error: 'Refresh token already used' });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });

  if (!user) {
    await prisma.session.delete({ where: { id: session.id } });
    return res.status(401).json({ error: 'Invalid session' });
  }

  const accessToken = signUserAccessToken(user);
  const metadata = extractSessionMetadata(req);

  const newSession = await prisma.$transaction(async (tx) => {
    await tx.session.update({ where: { id: session.id }, data: { rotatedAt: now } });
    return tx.session.create({ data: buildSessionData(user.id, metadata) });
  });

  const responseUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    managerId: user.managerId,
    department: user.department ?? null,
    roleTemplateId: user.roleTemplateId ?? null,
    progressHistory: user.progressHistory ?? []
  };

  setRefreshCookie(res, newSession.token);

  return res.json({
    accessToken,
    refreshExpiresAt: newSession.expiresAt.toISOString(),
    user: mapUserToUi(responseUser)
  });
});

export { refresh };
