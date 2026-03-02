import type { Request, Response } from 'express';
import { ENV } from '../config/env.js';

const refreshCookieName = 'nyx_refresh';

function cookieBaseOptions() {
  const isProd = ENV.NODE_ENV === 'production';
  const sameSite: 'lax' | 'none' = isProd ? 'none' : 'lax';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite,
    path: '/'
  };
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(refreshCookieName, token, {
    ...cookieBaseOptions(),
    maxAge: 1000 * 60 * 60 * 24 * 30
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(refreshCookieName, cookieBaseOptions());
}

export function readRefreshCookie(req: Request) {
  const header = req.header('cookie');
  if (!header) return null;
  const parts = header.split(';').map((part) => part.trim());
  for (const part of parts) {
    if (!part) continue;
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim();
    if (name !== refreshCookieName) continue;
    return decodeURIComponent(part.slice(idx + 1));
  }
  return null;
}
