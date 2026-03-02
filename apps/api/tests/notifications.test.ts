import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Role } from '@prisma/client';

vi.mock('../src/lib/prisma', () => import('./mocks/prisma'));

import { createApp } from '../src/app';
import { signAccessToken } from '../src/utils/token';
import { mockDb, resetDb } from './mocks/prisma';

function authHeader(user: { id: string; role: Role }) {
  return { Authorization: `Bearer ${signAccessToken(user)}` };
}

describe('Notification routes', () => {
  beforeEach(() => {
    resetDb();
  });

  it('lists notifications for the authenticated user', async () => {
    const app = createApp();
    const res = await request(app).get('/notifications').set(authHeader({ id: 'user-1', role: Role.USER }));

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0].userId).toBe('user-1');
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.totalPages).toBeGreaterThan(0);
  });

  it('marks notification as read', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/notifications/notif-1/read')
      .set(authHeader({ id: 'user-1', role: Role.USER }));

    expect(res.status).toBe(200);
    expect(res.body.notification.readAt).not.toBeNull();
    expect(mockDb.notifications.find((n) => n.id === 'notif-1')?.readAt).not.toBeNull();
  });
});
