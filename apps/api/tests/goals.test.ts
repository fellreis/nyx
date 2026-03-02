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

describe('Goal routes', () => {
  beforeEach(() => {
    resetDb();
  });

  it('prevents USER from completing monthly goals', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/goals/goal-1/complete')
      .set(authHeader({ id: 'user-1', role: Role.USER }))
      .send({ done: true });

    expect(res.status).toBe(403);
  });

  it('allows manager to complete subordinate goal and creates notification', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/goals/goal-2/complete')
      .set(authHeader({ id: 'manager-1', role: Role.MANAGER }))
      .send({ done: true });

    expect(res.status).toBe(200);
    expect(res.body.goal.status).toBe('Completed');
    expect(mockDb.notifications.some((n) => n.meta && (n.meta as any).goalId === 'goal-2')).toBe(true);
  });
});
