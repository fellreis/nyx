import request from 'supertest';
import { Role } from '@prisma/client';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../src/lib/prisma', () => import('./mocks/prisma'));

import { createApp } from '../src/app';
import { signAccessToken } from '../src/utils/token';
import { mockDb, resetDb } from './mocks/prisma';

function authHeader(user: { id: string; role: Role }) {
  return { Authorization: `Bearer ${signAccessToken(user)}` };
}

describe('User routes', () => {
  beforeEach(() => {
    resetDb();
  });

  it('returns current user profile and stats on /users/me', async () => {
    const app = createApp();

    const res = await request(app).get('/users/me').set(authHeader({ id: 'user-1', role: Role.USER }));

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: 'user-1',
      email: 'user1@example.com',
      role: 'employee',
      managerId: 'manager-1'
    });
    expect(res.body.stats.reviews.received).toBe(2);
    expect(res.body.stats.reviews.given).toBe(0);
    expect(res.body.stats.goals.total).toBe(2);
    expect(res.body.stats.goals.points).toEqual({ total: 88, completed: 80 });
    expect(res.body.stats.goals.byStatus).toEqual({ 'Not Started': 1, Completed: 1 });
  });

  it('allows admin to fetch any user by id with stats', async () => {
    const app = createApp();

    const res = await request(app).get('/users/user-1').set(authHeader({ id: 'admin-1', role: Role.ADMIN }));

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: 'user-1', email: 'user1@example.com' });
    expect(res.body.stats.reviews.received).toBeGreaterThan(0);
  });

  it('blocks manager from fetching non-subordinate', async () => {
    const app = createApp();

    const res = await request(app).get('/users/admin-1').set(authHeader({ id: 'manager-1', role: Role.MANAGER }));

    expect(res.status).toBe(403);
  });

  it('lists only subordinates for a manager', async () => {
    const app = createApp();

    const res = await request(app).get('/users').set(authHeader({ id: 'manager-1', role: Role.MANAGER }));

    expect(res.status).toBe(200);
    expect(res.body.items.map((u: { id: string }) => u.id).sort()).toEqual(['user-1', 'user-2']);
    expect(res.body.total).toBe(2);
  });

  it('updates password for a user as admin', async () => {
    const app = createApp();

    const res = await request(app)
      .patch('/users/user-1/password')
      .set(authHeader({ id: 'admin-1', role: Role.ADMIN }))
      .send({ password: 'new-pass-123' });

    expect(res.status).toBe(204);
    const updated = mockDb.users.find((u) => u.id === 'user-1');
    expect(updated?.passwordHash).not.toBe('hash-user1');
  });
});
