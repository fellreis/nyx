import { GoalStatus, GoalType, Role } from '@prisma/client';
import { z } from 'zod';

export const uiRoleValues = ['admin', 'manager', 'employee'] as const;
export type UiRole = (typeof uiRoleValues)[number];

export const uiGoalTypeValues = ['Monthly Task', 'Role Goal'] as const;
export type UiGoalType = (typeof uiGoalTypeValues)[number];

export const uiGoalStatusValues = ['Not Started', 'In Progress', 'On Track', 'At Risk', 'Completed'] as const;
export type UiGoalStatus = (typeof uiGoalStatusValues)[number];

export function mapRoleToUi(role: Role): UiRole {
  switch (role) {
    case Role.ADMIN:
      return 'admin';
    case Role.MANAGER:
      return 'manager';
    default:
      return 'employee';
  }
}

export function mapRoleFromUi(value: Role | string): Role {
  if (value === Role.ADMIN || value === Role.MANAGER || value === Role.USER) return value;
  switch (value) {
    case 'admin':
      return Role.ADMIN;
    case 'manager':
      return Role.MANAGER;
    case 'employee':
      return Role.USER;
    default:
      return Role.USER;
  }
}

export function mapGoalTypeToUi(type: GoalType): UiGoalType {
  return type === GoalType.ROLE ? 'Role Goal' : 'Monthly Task';
}

export function mapGoalTypeFromUi(value: GoalType | string): GoalType {
  if (value === GoalType.BASIC || value === GoalType.MONTHLY || value === GoalType.ROLE) return value;
  switch (value) {
    case 'Role Goal':
      return GoalType.ROLE;
    case 'Monthly Task':
      return GoalType.MONTHLY;
    default:
      return GoalType.BASIC;
  }
}

export function mapGoalStatusToUi(status: GoalStatus): UiGoalStatus {
  return status === GoalStatus.DONE ? 'Completed' : 'Not Started';
}

export function mapGoalStatusFromUi(value: GoalStatus | string): GoalStatus {
  if (value === GoalStatus.DONE || value === GoalStatus.PENDING) return value;
  switch (value) {
    case 'Completed':
      return GoalStatus.DONE;
    case 'Not Started':
    case 'In Progress':
    case 'On Track':
    case 'At Risk':
    default:
      return GoalStatus.PENDING;
  }
}

export const uiRoleSchema = z
  .union([z.nativeEnum(Role), z.enum(uiRoleValues)])
  .transform((value) => mapRoleFromUi(value));

export const uiGoalTypeSchema = z
  .union([z.nativeEnum(GoalType), z.enum(uiGoalTypeValues)])
  .transform((value) => mapGoalTypeFromUi(value));

export const uiGoalStatusInputSchema = z.union([z.nativeEnum(GoalStatus), z.enum(uiGoalStatusValues)]);
export const uiGoalStatusSchema = uiGoalStatusInputSchema.transform((value) => mapGoalStatusFromUi(value));

export function mapUserToUi<T extends { role: Role }>(user: T) {
  return {
    ...user,
    role: mapRoleToUi(user.role)
  };
}

type GoalMeta = {
  progress?: number;
  deadline?: string;
  subtasks?: Array<{ id: number | string; title: string; completed: boolean }>;
  dependencies?: Array<number | string>;
  category?: string;
  reviewPeriod?: string;
  isPromotionBlocker?: boolean;
  uiStatus?: UiGoalStatus;
};

export function mapGoalToUi<T extends { type: GoalType; status: GoalStatus; role?: Role | null; dependsOnId?: string | null; meta?: unknown }>(
  goal: T
) {
  const { meta: rawMeta, ...rest } = goal as any;
  const meta = (rawMeta as GoalMeta | null) ?? {};
  const dependencies = meta.dependencies ?? (goal.dependsOnId ? [goal.dependsOnId] : []);
  const status = meta.uiStatus ?? mapGoalStatusToUi(goal.status);

  return {
    ...rest,
    type: mapGoalTypeToUi(goal.type),
    status,
    progress: meta.progress ?? (goal.status === GoalStatus.DONE ? 100 : 0),
    deadline: meta.deadline,
    subtasks: meta.subtasks ?? [],
    dependencies,
    category: meta.category,
    reviewPeriod: meta.reviewPeriod,
    isPromotionBlocker: meta.isPromotionBlocker ?? false,
    role: goal.role ? mapRoleToUi(goal.role) : null
  };
}

export function mapNotificationToUi<T extends { readAt: Date | null; createdAt: Date }>(notification: T) {
  return {
    ...notification,
    read: Boolean(notification.readAt),
    timestamp: notification.createdAt.toISOString()
  };
}

type ReviewMeta = {
  month?: string;
  managerFeedback?: string;
  completedTaskIds?: Array<number | string>;
  pendingTaskIds?: Array<number | string>;
  roleGoalProgress?: Array<{ goalId: number | string; progress: number }>;
  monthlyTaskCategoryDistribution?: Record<string, number>;
};

export function mapReviewToUi<T extends { meta?: unknown; createdAt: Date; score?: number | null; comments?: string | null; summary: string }>(
  review: T
) {
  const meta = (review.meta as ReviewMeta | null) ?? {};
  return {
    createdAt: review.createdAt.toISOString(),
    month: meta.month ?? review.createdAt.toISOString().slice(0, 7),
    score: review.score ?? 0,
    managerFeedback: meta.managerFeedback ?? review.comments ?? review.summary,
    completedTaskIds: meta.completedTaskIds ?? [],
    pendingTaskIds: meta.pendingTaskIds ?? [],
    roleGoalProgress: meta.roleGoalProgress ?? [],
    ...(meta.monthlyTaskCategoryDistribution ? { monthlyTaskCategoryDistribution: meta.monthlyTaskCategoryDistribution } : {})
  };
}

export function buildGoalMeta(payload: Partial<GoalMeta>, existing?: unknown) {
  const base = (existing as GoalMeta | null) ?? {};
  const merged = { ...base, ...payload };
  Object.keys(merged).forEach((key) => {
    if (merged[key as keyof GoalMeta] === undefined) {
      delete merged[key as keyof GoalMeta];
    }
  });
  return merged;
}

export function buildReviewMeta(payload: Partial<ReviewMeta>, existing?: unknown) {
  const base = (existing as ReviewMeta | null) ?? {};
  const merged = { ...base, ...payload };
  Object.keys(merged).forEach((key) => {
    if (merged[key as keyof ReviewMeta] === undefined) {
      delete merged[key as keyof ReviewMeta];
    }
  });
  return merged;
}

export function mapGoalStatsToUi(stats: {
  reviews: { received: number; given: number };
  goals: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    points: { total: number; completed: number };
  };
}) {
  const byStatus: Record<string, number> = {};
  Object.entries(stats.goals.byStatus).forEach(([key, value]) => {
    const mapped = mapGoalStatusToUi(key as GoalStatus);
    byStatus[mapped] = value;
  });

  const byType: Record<string, number> = {};
  Object.entries(stats.goals.byType).forEach(([key, value]) => {
    const mapped = mapGoalTypeToUi(key as GoalType);
    byType[mapped] = (byType[mapped] ?? 0) + value;
  });

  return {
    ...stats,
    goals: {
      ...stats.goals,
      byStatus,
      byType
    }
  };
}

type UiTeamNode<T extends { role: Role; reports: T[] }> = Omit<T, 'role' | 'reports'> & {
  role: UiRole;
  reports: UiTeamNode<T>[];
};

export function mapTeamToUi<T extends { role: Role; reports: T[] }>(node: T): UiTeamNode<T> {
  return {
    ...node,
    role: mapRoleToUi(node.role),
    reports: node.reports.map((child) => mapTeamToUi(child))
  };
}
