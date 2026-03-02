import { Router, type Request, type Response } from 'express';
import { GoalStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middlewares/auth.js';
import { mapTeamToUi } from '../lib/ui-mapper.js';

type UserNode = {
  id: string;
  email: string;
  name: string;
  role: Role;
  managerId: string | null;
  isActive: boolean;
  createdAt: Date;
  stats: {
    goals: {
      total: number;
      pending: number;
      done: number;
    };
    reviews: {
      received: number;
      given: number;
    };
  };
  reports: UserNode[];
};

const team = Router();

async function fetchUsersForScope(user: { id: string; role: Role }) {
  if (user.role === Role.ADMIN) {
    return prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  }

  // Managers: fetch themselves + subordinates
  const all = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  const allowedIds = new Set<string>();

  function collect(id: string) {
    if (allowedIds.has(id)) return;
    allowedIds.add(id);
    const children = all.filter((u) => u.managerId === id);
    children.forEach((child) => collect(child.id));
  }

  collect(user.id);
  return all.filter((u) => allowedIds.has(u.id));
}

async function buildStatsMap(userIds: string[]) {
  if (!userIds.length) return { goals: new Map(), reviewsReceived: new Map(), reviewsGiven: new Map() };

  const goalsByStatus = await prisma.goal.groupBy({
    by: ['assignedToId', 'status'],
    where: { assignedToId: { in: userIds } },
    _count: { _all: true }
  });

  const reviewsReceived = await prisma.review.groupBy({
    by: ['revieweeId'],
    where: { revieweeId: { in: userIds } },
    _count: { _all: true }
  });

  const reviewsGiven = await prisma.review.groupBy({
    by: ['reviewerId'],
    where: { reviewerId: { in: userIds } },
    _count: { _all: true }
  });

  const goalMap = new Map<string, { pending: number; done: number }>();
  goalsByStatus.forEach((entry) => {
    const current = goalMap.get(entry.assignedToId) ?? { pending: 0, done: 0 };
    if (entry.status === GoalStatus.DONE) current.done = entry._count._all;
    if (entry.status === GoalStatus.PENDING) current.pending = entry._count._all;
    goalMap.set(entry.assignedToId, current);
  });

  const receivedMap = new Map(reviewsReceived.map((r) => [r.revieweeId, r._count._all]));
  const givenMap = new Map(reviewsGiven.map((r) => [r.reviewerId, r._count._all]));

  return {
    goals: goalMap,
    reviewsReceived: receivedMap,
    reviewsGiven: givenMap
  };
}

function buildTree(users: Array<UserNode & { reports?: UserNode[] }>, stats: Awaited<ReturnType<typeof buildStatsMap>>) {
  const byId = new Map<string, UserNode>();
  const roots: UserNode[] = [];

  users.forEach((user) => {
    const goalStat = stats.goals.get(user.id) ?? { pending: 0, done: 0 };
    const received = stats.reviewsReceived.get(user.id) ?? 0;
    const given = stats.reviewsGiven.get(user.id) ?? 0;

    byId.set(user.id, {
      ...user,
      stats: {
        goals: {
          total: goalStat.pending + goalStat.done,
          pending: goalStat.pending,
          done: goalStat.done
        },
        reviews: {
          received,
          given
        }
      },
      reports: []
    });
  });

  users.forEach((user) => {
    const node = byId.get(user.id)!;
    if (user.managerId && byId.has(user.managerId)) {
      byId.get(user.managerId)!.reports.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

team.get('/team', authenticate, async (req: Request, res: Response) => {
  const request = req as Request & { user?: { id: string; role: Role } };
  if (!request.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (request.user.role === Role.USER) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const scopedUsers = await fetchUsersForScope(request.user);
  const stats = await buildStatsMap(scopedUsers.map((u) => u.id));
  const tree = buildTree(scopedUsers as unknown as UserNode[], stats);

  return res.json({ team: tree.map((node) => mapTeamToUi(node)) });
});

export { team };
