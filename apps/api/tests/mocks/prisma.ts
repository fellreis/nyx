import { randomUUID } from 'node:crypto';
import { GoalStatus, GoalType, Role } from '@prisma/client';

type UserRecord = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  passwordHash: string;
  department?: string | null;
  roleTemplateId?: number | null;
  progressHistory?: Array<{ date: string; score: number; tasksCompleted: number }> | null;
  managerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type GoalRecord = {
  id: string;
  title: string;
  type: GoalType;
  role: Role | null;
  points: number;
  assignedToId: string;
  status: GoalStatus;
  createdAt: Date;
  doneAt?: Date | null;
  dependsOnId?: string | null;
  createdById?: string;
  meta?: unknown;
};

type ReviewRecord = {
  id: string;
  reviewerId: string;
  revieweeId: string;
  summary: string;
  comments?: string;
  score?: number | null;
  createdAt: Date;
  meta?: unknown;
};

type ReviewGoalRecord = {
  reviewId: string;
  goalId: string;
  createdAt: Date;
};

type SessionRecord = {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  rotatedAt?: Date | null;
  userAgent?: string | null;
  ip?: string | null;
};

type NotificationRecord = {
  id: string;
  userId: string;
  message: string;
  readAt: Date | null;
  meta?: unknown;
  createdAt: Date;
  updatedAt: Date;
};

type MockDb = {
  users: UserRecord[];
  goals: GoalRecord[];
  reviews: ReviewRecord[];
  reviewGoals: ReviewGoalRecord[];
  sessions: SessionRecord[];
  notifications: NotificationRecord[];
};

const now = new Date();

const seedDb: MockDb = {
  users: [
    {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: Role.ADMIN,
      isActive: true,
      passwordHash: 'admin123',
      managerId: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'manager-1',
      email: 'manager@example.com',
      name: 'Manager',
      role: Role.MANAGER,
      isActive: true,
      passwordHash: 'manager123',
      managerId: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'user-1',
      email: 'user1@example.com',
      name: 'User One',
      role: Role.USER,
      isActive: true,
      passwordHash: 'user123',
      managerId: 'manager-1',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'user-2',
      email: 'user2@example.com',
      name: 'User Two',
      role: Role.USER,
      isActive: true,
      passwordHash: 'user123',
      managerId: 'manager-1',
      createdAt: now,
      updatedAt: now
    }
  ],
  goals: [
    {
      id: 'goal-1',
      title: 'Goal Pending',
      type: GoalType.MONTHLY,
      role: null,
      points: 8,
      assignedToId: 'user-1',
      status: GoalStatus.PENDING,
      createdAt: now,
      createdById: 'manager-1'
    },
    {
      id: 'goal-2',
      title: 'Goal Done',
      type: GoalType.BASIC,
      role: null,
      points: 80,
      assignedToId: 'user-1',
      status: GoalStatus.DONE,
      createdAt: now,
      createdById: 'manager-1'
    },
    {
      id: 'goal-3',
      title: 'Other User Goal',
      type: GoalType.ROLE,
      role: null,
      points: 8,
      assignedToId: 'user-2',
      status: GoalStatus.PENDING,
      createdAt: now,
      createdById: 'manager-1'
    }
  ],
  reviews: [
    {
      id: 'review-1',
      reviewerId: 'manager-1',
      revieweeId: 'user-1',
      summary: 'First review',
      comments: '',
      score: 4,
      createdAt: now
    },
    {
      id: 'review-2',
      reviewerId: 'admin-1',
      revieweeId: 'user-1',
      summary: 'Admin review',
      comments: '',
      score: 5,
      createdAt: now
    },
    {
      id: 'review-3',
      reviewerId: 'manager-1',
      revieweeId: 'user-2',
      summary: 'Second review',
      comments: '',
      score: 3,
      createdAt: now
    }
  ],
  reviewGoals: [],
  sessions: [],
  notifications: [
    {
      id: 'notif-1',
      userId: 'user-1',
      message: 'Test notification',
      readAt: null,
      createdAt: now,
      updatedAt: now
    }
  ]
};

function cloneUsers() {
  return seedDb.users.map((user) => ({
    ...user,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt)
  }));
}

function cloneGoals() {
  return seedDb.goals.map((goal) => ({
    ...goal,
    createdAt: new Date(goal.createdAt),
    doneAt: goal.doneAt ? new Date(goal.doneAt) : null
  }));
}

function cloneReviews() {
  return seedDb.reviews.map((review) => ({ ...review, createdAt: new Date(review.createdAt) }));
}

function cloneNotifications() {
  return seedDb.notifications.map((n) => ({ ...n, createdAt: new Date(n.createdAt), updatedAt: new Date(n.updatedAt) }));
}

export const mockDb: MockDb = {
  users: [],
  goals: [],
  reviews: [],
  reviewGoals: [],
  sessions: [],
  notifications: []
};

export function resetDb() {
  mockDb.users = cloneUsers();
  mockDb.goals = cloneGoals();
  mockDb.reviews = cloneReviews();
  mockDb.reviewGoals = [];
  mockDb.sessions = [];
  mockDb.notifications = cloneNotifications();
}

resetDb();

function cloneWithSelect<T extends Record<string, unknown>>(item: T, select?: Record<string, boolean>) {
  if (!select) return { ...item };
  return Object.keys(select).reduce<Record<string, unknown>>((acc, key) => {
    if (select[key]) acc[key] = item[key];
    return acc;
  }, {}) as T;
}

function matchesSearch(user: UserRecord, search?: { OR?: Array<{ name?: { contains: string }; email?: { contains: string } }> }) {
  if (!search?.OR) return true;
  return search.OR.some((condition) => {
    if (condition.name?.contains) {
      const term = condition.name.contains.toLowerCase();
      if (user.name.toLowerCase().includes(term)) return true;
    }
    if (condition.email?.contains) {
      const term = condition.email.contains.toLowerCase();
      if (user.email.toLowerCase().includes(term)) return true;
    }
    return false;
  });
}

function filterUsers(where?: Record<string, unknown>): UserRecord[] {
  if (!where) return mockDb.users.slice();
  return mockDb.users.filter((user) => {
    if (where.role && user.role !== where.role) return false;
    if (where.isActive !== undefined && user.isActive !== where.isActive) return false;
    if (where.managerId !== undefined && user.managerId !== where.managerId) return false;
    if (!matchesSearch(user, where as { OR?: Array<{ name?: { contains: string }; email?: { contains: string } }> })) return false;
    return true;
  });
}

function filterGoals(where?: Record<string, any>): GoalRecord[] {
  if (!where) return mockDb.goals.slice();
  return mockDb.goals.filter((goal) => {
    if (where.id) {
      const idFilter = where.id as { in?: string[] } | string;
      if (typeof idFilter === 'string' && goal.id !== idFilter) return false;
      if (typeof idFilter === 'object' && Array.isArray(idFilter.in) && !idFilter.in.includes(goal.id)) return false;
    }
    if (where.type && goal.type !== where.type) return false;
    if (where.role && goal.role !== where.role) return false;
    if (where.status && goal.status !== where.status) return false;
    if (where.assignedToId && goal.assignedToId !== where.assignedToId) return false;
    if (where.assignedTo?.managerId) {
      const user = mockDb.users.find((u) => u.id === goal.assignedToId);
      if (user?.managerId !== where.assignedTo.managerId) return false;
    }
    return true;
  });
}

export const prisma = {
  user: {
    async findUnique({ where, select }: { where: { id?: string; email?: string }; select?: Record<string, boolean> }) {
      const found = mockDb.users.find((u) => (where.id ? u.id === where.id : u.email === where.email));
      return found ? cloneWithSelect(found, select) : null;
    },
    async findMany({
      where,
      orderBy,
      skip = 0,
      take = Number.MAX_SAFE_INTEGER,
      select
    }: {
      where?: Record<string, unknown>;
      orderBy?: { createdAt: 'asc' | 'desc' };
      skip?: number;
      take?: number;
      select?: Record<string, boolean>;
    }) {
      let results = filterUsers(where);
      if (orderBy?.createdAt === 'desc') {
        results = results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      return results.slice(skip, skip + take).map((user) => cloneWithSelect(user, select));
    },
    async count({ where }: { where?: Record<string, unknown> }) {
      return filterUsers(where).length;
    },
    async update({
      where,
      data,
      select
    }: {
      where: { id: string };
      data: Partial<UserRecord>;
      select?: Record<string, boolean>;
    }) {
      const idx = mockDb.users.findIndex((u) => u.id === where.id);
      if (idx === -1) return null;
      const updated = { ...mockDb.users[idx], ...data, updatedAt: new Date() };
      mockDb.users[idx] = updated;
      return cloneWithSelect(updated, select);
    },
    async create({ data }: { data: Partial<UserRecord> }) {
      const newUser: UserRecord = {
        id: data.id ?? `user-${mockDb.users.length + 1}`,
        email: data.email ?? '',
        name: data.name ?? '',
        role: (data.role as Role) ?? Role.USER,
        isActive: data.isActive ?? true,
        passwordHash: data.passwordHash ?? '',
        department: (data as any).department ?? null,
        roleTemplateId: (data as any).roleTemplateId ?? null,
        progressHistory: (data as any).progressHistory ?? [],
        managerId: (data.managerId as string | null) ?? null,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date()
      };
      mockDb.users.push(newUser);
      return newUser;
    }
  },
  goal: {
    async findUnique({ where }: { where: { id: string } }) {
      return mockDb.goals.find((g) => g.id === where.id) ?? null;
    },
    async findMany({
      where,
      orderBy,
      skip = 0,
      take = Number.MAX_SAFE_INTEGER
    }: {
      where?: Record<string, unknown>;
      orderBy?: { createdAt: 'asc' | 'desc' };
      skip?: number;
      take?: number;
    }) {
      let results = filterGoals(where);
      if (orderBy?.createdAt === 'desc') {
        results = results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      return results.slice(skip, skip + take);
    },
    async count({ where }: { where?: Record<string, unknown> }) {
      return filterGoals(where).length;
    },
    async create({ data }: { data: Partial<GoalRecord> }) {
      const goal: GoalRecord = {
        id: data.id ?? `goal-${mockDb.goals.length + 1}`,
        title: data.title ?? '',
        description: (data as any).description ?? undefined,
        type: (data.type as GoalType) ?? GoalType.BASIC,
        role: (data.role as Role | null) ?? null,
        points: data.points ?? 0,
        assignedToId: data.assignedToId ?? '',
        status: (data.status as GoalStatus) ?? GoalStatus.PENDING,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        doneAt: data.doneAt ? new Date(data.doneAt) : null,
        dependsOnId: data.dependsOnId ?? null,
        createdById: data.createdById,
        meta: (data as any).meta
      };
      mockDb.goals.push(goal);
      return goal;
    },
    async createMany({ data }: { data: Array<Partial<GoalRecord>> }) {
      data.forEach((entry) => {
        const goal: GoalRecord = {
          id: entry.id ?? `goal-${mockDb.goals.length + 1}`,
          title: entry.title ?? '',
          description: (entry as any).description ?? undefined,
          type: (entry.type as GoalType) ?? GoalType.BASIC,
          role: (entry.role as Role | null) ?? null,
          points: entry.points ?? 0,
          assignedToId: entry.assignedToId ?? '',
          status: (entry.status as GoalStatus) ?? GoalStatus.PENDING,
          createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
          doneAt: entry.doneAt ? new Date(entry.doneAt) : null,
          dependsOnId: entry.dependsOnId ?? null,
          createdById: entry.createdById,
          meta: (entry as any).meta
        };
        mockDb.goals.push(goal);
      });
      return { count: data.length };
    },
    async update({ where, data }: { where: { id: string }; data: Partial<GoalRecord> }) {
      const idx = mockDb.goals.findIndex((g) => g.id === where.id);
      if (idx === -1) return null;
      const updated = { ...mockDb.goals[idx], ...data, updatedAt: new Date() };
      mockDb.goals[idx] = updated;
      return updated;
    },
    async delete({ where }: { where: { id: string } }) {
      const idx = mockDb.goals.findIndex((g) => g.id === where.id);
      if (idx === -1) return null;
      const [deleted] = mockDb.goals.splice(idx, 1);
      return deleted;
    },
    async groupBy({
      by,
      where,
      _count
    }: {
      by: Array<'status' | 'type' | 'assignedToId'>;
      where?: { assignedToId?: string; assignedToIdIn?: string[] };
      _count: { _all: true };
    }) {
      const field = by[0];
      let goals = mockDb.goals.slice();
      if (where?.assignedToId) goals = goals.filter((g) => g.assignedToId === where.assignedToId);
      const counts = new Map<string, number>();
      goals.forEach((goal) => {
        const key = (goal as any)[field];
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      return Array.from(counts.entries()).map(([key, value]) => ({
        [field]: key,
        _count: { _all: value }
      })) as Array<{ status?: GoalStatus; type?: GoalType; assignedToId?: string; _count: { _all: number } }>;
    },
    async aggregate({
      where,
      _sum
    }: {
      where: { assignedToId?: string; status?: GoalStatus };
      _sum: { points: true };
    }) {
      const sum = mockDb.goals
        .filter((goal) => {
          if (where.assignedToId && goal.assignedToId !== where.assignedToId) return false;
          if (where.status && goal.status !== where.status) return false;
          return true;
        })
        .reduce((acc, goal) => acc + goal.points, 0);
      return { _sum: { points: sum || null } };
    }
  },
  review: {
    async groupBy({
      by,
      where,
      _count
    }: {
      by: Array<'revieweeId' | 'reviewerId'>;
      where?: { revieweeId?: string; reviewerId?: string };
      _count: { _all: true };
    }) {
      const field = by[0];
      const items = mockDb.reviews.filter((review) => {
        if (where?.revieweeId && review.revieweeId !== where.revieweeId) return false;
        if (where?.reviewerId && review.reviewerId !== where.reviewerId) return false;
        return true;
      });
      const counts = new Map<string, number>();
      items.forEach((review) => {
        const key = (review as any)[field];
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
      return Array.from(counts.entries()).map(([key, value]) => ({
        [field]: key,
        _count: { _all: value }
      }));
    },
    async findMany({
      where,
      orderBy,
      skip = 0,
      take = Number.MAX_SAFE_INTEGER,
      include
    }: {
      where?: { revieweeId?: string; reviewerId?: string; reviewee?: { managerId?: string } };
      orderBy?: { createdAt: 'asc' | 'desc' };
      skip?: number;
      take?: number;
      include?: { goals?: { select: { goalId: boolean } } };
    }) {
      let results = mockDb.reviews.filter((review) => {
        if (where?.revieweeId && review.revieweeId !== where.revieweeId) return false;
        if (where?.reviewerId && review.reviewerId !== where.reviewerId) return false;
        if (where?.reviewee?.managerId) {
          const user = mockDb.users.find((u) => u.id === review.revieweeId);
          if (user?.managerId !== where.reviewee.managerId) return false;
        }
        return true;
      });
      if (orderBy?.createdAt === 'desc') {
        results = results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      const paged = results.slice(skip, skip + take);
      return paged.map((review) => ({
        ...review,
        goals: include?.goals ? mockDb.reviewGoals.filter((rg) => rg.reviewId === review.id).map((rg) => ({ goalId: rg.goalId })) : undefined
      }));
    },
    async findUnique({
      where,
      include
    }: {
      where: { id: string };
      include?: { reviewee?: boolean; reviewer?: boolean; goals?: { select: { goalId: boolean } } };
    }) {
      const review = mockDb.reviews.find((r) => r.id === where.id);
      if (!review) return null;
      return {
        ...review,
        reviewee: include?.reviewee ? mockDb.users.find((u) => u.id === review.revieweeId) : undefined,
        reviewer: include?.reviewer ? mockDb.users.find((u) => u.id === review.reviewerId) : undefined,
        goals: include?.goals
          ? mockDb.reviewGoals.filter((rg) => rg.reviewId === review.id).map((rg) => ({ goalId: rg.goalId }))
          : undefined
      };
    },
    async create({
      data,
      include
    }: {
      data: { reviewerId: string; revieweeId: string; comments?: string; summary: string; score?: number | null; meta?: unknown };
      include?: { goals?: boolean };
    }) {
      const review: ReviewRecord = {
        id: `review-${mockDb.reviews.length + 1}`,
        reviewerId: data.reviewerId,
        revieweeId: data.revieweeId,
        comments: data.comments,
        summary: data.summary,
        score: data.score ?? null,
        createdAt: new Date(),
        meta: data.meta
      };
      mockDb.reviews.push(review);
      return { ...review, goals: include?.goals ? [] : undefined };
    },
    async count({ where }: { where: { revieweeId?: string; reviewerId?: string } }) {
      return mockDb.reviews.filter((review) => {
        if (where.revieweeId && review.revieweeId !== where.revieweeId) return false;
        if (where.reviewerId && review.reviewerId !== where.reviewerId) return false;
        return true;
      }).length;
    }
  },
  reviewGoal: {
    async createMany({ data }: { data: Array<{ reviewId: string; goalId: string }> }) {
      data.forEach((entry) => {
        const exists = mockDb.reviewGoals.find((rg) => rg.reviewId === entry.reviewId && rg.goalId === entry.goalId);
        if (!exists) {
          mockDb.reviewGoals.push({ ...entry, createdAt: new Date() });
        }
      });
      return { count: data.length };
    }
  },
  notification: {
    async findMany({
      where,
      orderBy,
      skip = 0,
      take = Number.MAX_SAFE_INTEGER
    }: {
      where: { userId: string; readAt?: null };
      orderBy?: { createdAt: 'asc' | 'desc' };
      skip?: number;
      take?: number;
    }) {
      let results = mockDb.notifications.filter((n) => {
        if (n.userId !== where.userId) return false;
        if (where.readAt === null && n.readAt !== null) return false;
        return true;
      });

      if (orderBy?.createdAt === 'desc') {
        results = results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      } else if (orderBy?.createdAt === 'asc') {
        results = results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      }

      return results.slice(skip, skip + take);
    },
    async findUnique({ where }: { where: { id: string } }) {
      return mockDb.notifications.find((n) => n.id === where.id) ?? null;
    },
    async update({ where, data }: { where: { id: string }; data: Partial<NotificationRecord> }) {
      const idx = mockDb.notifications.findIndex((n) => n.id === where.id);
      if (idx === -1) return null;
      const updated = { ...mockDb.notifications[idx], ...data, updatedAt: new Date() };
      mockDb.notifications[idx] = updated;
      return updated;
    },
    async create({ data }: { data: Partial<NotificationRecord> }) {
      const notif: NotificationRecord = {
        id: data.id ?? `notif-${mockDb.notifications.length + 1}`,
        userId: data.userId ?? '',
        message: data.message ?? '',
        readAt: data.readAt ?? null,
        meta: data.meta,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockDb.notifications.push(notif);
      return notif;
    },
    async count({ where }: { where: { userId: string; readAt?: null } }) {
      return mockDb.notifications.filter((n) => {
        if (n.userId !== where.userId) return false;
        if (where.readAt === null && n.readAt !== null) return false;
        return true;
      }).length;
    }
  },
  session: {
    async create({ data }: { data: Partial<SessionRecord> }) {
      const session: SessionRecord = {
        id: data.id ?? `session-${mockDb.sessions.length + 1}`,
        userId: data.userId ?? '',
        token: data.token ?? randomUUID(),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 1000 * 60 * 60),
        rotatedAt: data.rotatedAt ?? null,
        userAgent: data.userAgent ?? null,
        ip: data.ip ?? null
      };
      mockDb.sessions.push(session);
      return session;
    },
    async findUnique({ where }: { where: { token?: string; id?: string } }) {
      return mockDb.sessions.find((s) => (where.token ? s.token === where.token : s.id === where.id)) ?? null;
    },
    async delete({ where }: { where: { id: string } }) {
      const idx = mockDb.sessions.findIndex((s) => s.id === where.id);
      if (idx !== -1) mockDb.sessions.splice(idx, 1);
    },
    async update({ where, data }: { where: { id: string }; data: Partial<SessionRecord> }) {
      const idx = mockDb.sessions.findIndex((s) => s.id === where.id);
      if (idx === -1) return null;
      const updated = { ...mockDb.sessions[idx], ...data };
      mockDb.sessions[idx] = updated;
      return updated;
    }
  },
  $transaction: async <T>(cb: (tx: typeof prisma) => Promise<T>) => cb(prisma)
};
