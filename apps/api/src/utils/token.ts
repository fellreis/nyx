import jwt, { type Secret } from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { ENV } from '../config/env.js';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export function signAccessToken(user: { id: string; role: Role }) {
  const secret: Secret = ENV.JWT_ACCESS_SECRET as Secret;
  const accessExpiresIn = ENV.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'];
  const options: jwt.SignOptions = { expiresIn: accessExpiresIn };

  return jwt.sign(
    {
      sub: user.id,
      role: user.role
    },
    secret,
    options
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ENV.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function parseDurationToMs(input: string): number {
  const numeric = Number(input);
  if (!Number.isNaN(numeric)) return numeric;

  const match = input.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 0;
  }

  const value = Number(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 1000 * 60,
    h: 1000 * 60 * 60,
    d: 1000 * 60 * 60 * 24
  };

  return value * (multipliers[unit] ?? 1);
}
