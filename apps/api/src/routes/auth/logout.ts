import { Router, type Request, type Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middlewares/auth.js';
import { logoutSchema } from './shared.js';
import { clearRefreshCookie, readRefreshCookie } from '../../utils/cookies.js';

const logout = Router();

logout.post('/auth/logout', authenticate, async (req: Request, res: Response) => {
  const parsed = logoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const refreshToken = parsed.data.refreshToken ?? readRefreshCookie(req);
  if (refreshToken) {
    const session = await prisma.session.findUnique({ where: { token: refreshToken } });

    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
  }

  clearRefreshCookie(res);
  return res.status(204).send();
});

export { logout };
