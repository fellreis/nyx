import { Role } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/token.js';

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = header.split(' ')[1];

  const request = req as Request & {
    user?: {
      id: string;
      role: Role;
    };
  };

  try {
    const payload = verifyAccessToken(token);
    request.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const request = req as Request & {
      user?: {
        id: string;
        role: Role;
      };
    };

    if (!request.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(request.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  };
}
