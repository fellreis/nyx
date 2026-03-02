import request from 'supertest';
import { Role } from '@prisma/client';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/prisma', () => import('./mocks/prisma'));

import { createApp } from '../src/app';
import { signAccessToken } from '../src/utils/token';
import { mockDb, resetDb } from './mocks/prisma';

function authHeader(user: { id: string; role: Role }) {
  return { Authorization: `Bearer ${signAccessToken(user)}` };
}

describe('Auth routes', () => {
  beforeEach(() => {
    resetDb();
  });

  it('logs in and returns tokens', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('refreshes token with valid refresh', async () => {
    const app = createApp();

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'admin123' });

    const cookie = loginRes.headers['set-cookie'];
    const refreshRes = await request(app)
      .post('/auth/refresh')
      .set('Cookie', cookie);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.headers['set-cookie']).toBeDefined();
  });

  it('registers a user as admin', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/auth/register')
      .set(authHeader({ id: 'admin-1', role: Role.ADMIN }))
      .send({ email: 'new@example.com', name: 'New User', password: 'pass123', role: 'USER', managerId: 'manager-1' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@example.com');
  });

  it('logs out by deleting session', async () => {
    const app = createApp();

    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@example.com', password: 'admin123' });

    const cookie = loginRes.headers['set-cookie'];
    const refreshToken = mockDb.sessions[0]?.token;
    expect(refreshToken).toBeDefined();
    expect(mockDb.sessions.some((s) => s.token === refreshToken)).toBe(true);

    const logoutRes = await request(app).post('/auth/logout').set('Cookie', cookie);

    expect(logoutRes.status).toBe(204);
    expect(mockDb.sessions.some((s) => s.token === refreshToken)).toBe(false);
  });
});
