// FIX: Removed self-import of GoalStatus which caused a conflict with the local declaration.
export enum GoalStatus {
    NOT_STARTED = 'Not Started',
    IN_PROGRESS = 'In Progress',
    ON_TRACK = 'On Track',
    AT_RISK = 'At Risk',
    COMPLETED = 'Completed'
}

export enum UserRole {
    EMPLOYEE = 'employee',
    MANAGER = 'manager',
    ADMIN = 'admin'
}

export enum GoalType {
    MONTHLY_TASK = 'Monthly Task',
    ROLE = 'Role Goal'
}

export interface Review {
    createdAt?: string;
    month: string; // YYYY-MM
    score: number;
    managerFeedback: string;
    completedTaskIds: Array<number | string>;
    pendingTaskIds: Array<number | string>;
    roleGoalProgress: { goalId: number | string; progress: number; }[];
    monthlyTaskCategoryDistribution?: Record<string, number>;
}

export interface ProgressHistory {
    date: string; // YYYY-MM format
    score: number;
    tasksCompleted: number;
}

export interface Subtask {
    id: number | string;
    title: string;
    completed: boolean;
}

export interface Goal {
    id: number | string;
    title: string;
    description: string;
    points: number;
    status: GoalStatus;
    progress: number;
    deadline: string; // Should be ISO date string
    subtasks: Subtask[];
    dependencies: Array<number | string>;
    type: GoalType;
    category?: string; // For grouping monthly tasks
    reviewPeriod?: string; // e.g., "2024-11" for Monthly goals
    isPromotionBlocker?: boolean; // for Role goals
}

export interface User {
    id: number | string;
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    department: string;
    managerId?: number | string | null;
    roleTemplateId: number | null;
    goals: Goal[];
    progressHistory: ProgressHistory[];
    reviews?: Review[];
}

export interface Template {
    id: number;
    name: string;
    role: string;
    level: string;
    goals: {
        title: string;
        description: string;
        points: number;
        isPromotionBlocker?: boolean;
        subtasks?: string[];
    }[];
}

export interface Notification {
    id: number | string;
    userId: number | string;
    message: string;
    read: boolean;
    timestamp: Date | string;
}
