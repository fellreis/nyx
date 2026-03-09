import { Router, type Request, type Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { verifyPassword } from '../../utils/password.js';
import { loginRateLimiter } from '../../middlewares/rate-limit.js';
import { createSession, extractSessionMetadata, loginSchema, signUserAccessToken, buildUserResponse } from './shared.js';
import { mapUserToUi } from '../../lib/ui-mapper.js';
import { setRefreshCookie } from '../../utils/cookies.js';

const login = Router();

login.post('/auth/login', loginRateLimiter, async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);

  if (!passwordOk) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const accessToken = signUserAccessToken(user);
  const session = await createSession(user.id, extractSessionMetadata(req));

  const responseUser = buildUserResponse(user);
  setRefreshCookie(res, session.token);

  return res.json({
    accessToken,
    refreshExpiresAt: session.expiresAt.toISOString(),
    user: mapUserToUi(responseUser)
  });
});

export { login };
