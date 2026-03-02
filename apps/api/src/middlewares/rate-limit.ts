import type { Request } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 5;

function loginKey(req: Request) {
  const ip = typeof req.ip === 'string' ? ipKeyGenerator(req.ip) : 'unknown-ip';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'unknown-email';
  return `${ip}:${email}`;
}

export const loginRateLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  limit: LOGIN_MAX_ATTEMPTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: loginKey,
  message: { error: 'Too many login attempts. Please try again later.' }
});
