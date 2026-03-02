import fs from 'node:fs';
import request from 'supertest';
import { Role } from '@prisma/client';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/prisma', () => import('./mocks/prisma'));

import { createApp } from '../src/app';
import { signAccessToken } from '../src/utils/token';
import { resetDb } from './mocks/prisma';

function authHeader(user: { id: string; role: Role }) {
  return { Authorization: `Bearer ${signAccessToken(user)}` };
}

describe('Review routes', () => {
  beforeEach(() => {
    resetDb();
  });

  it('creates a review with goal attachments', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/reviews')
      .set(authHeader({ id: 'manager-1', role: Role.MANAGER }))
      .send({ revieweeId: 'user-1', summary: 'Great work', goalIds: ['goal-1', 'goal-2'] });

    expect(res.status).toBe(201);
    expect(res.body.review.month).toBeDefined();
    expect(res.body.review.managerFeedback).toBe('Great work');
  });

  it('returns summary counts', async () => {
    const app = createApp();
    const res = await request(app).get('/reviews/summary').set(authHeader({ id: 'user-1', role: Role.USER }));

    expect(res.status).toBe(200);
    expect(res.body.received).toBeGreaterThan(0);
  });

  it('exports a review to HTML and returns path', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/reviews/review-1/export')
      .set(authHeader({ id: 'manager-1', role: Role.MANAGER }));

    expect(res.status).toBe(200);
    expect(res.body.exportPath).toContain('tmp/exports/review-review-1.html');
    expect(fs.existsSync(res.body.exportPath)).toBe(true);
  });
});
