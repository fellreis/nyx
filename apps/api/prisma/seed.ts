import { PrismaClient, Role } from '@prisma/client';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { buildDefaultGoals } from '../src/lib/default-goals.js';

const prisma = new PrismaClient();

async function ensureUser(
  email: string,
  name: string,
  role: Role,
  password: string,
  managerId?: string,
  createdById?: string,
  extras?: { department?: string; roleTemplateId?: number | null; progressHistory?: Array<{ date: string; score: number; tasksCompleted: number }> }
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: {
      email,
      name,
      role,
      managerId: managerId ?? null,
      createdById: createdById ?? null,
      passwordHash,
      department: extras?.department ?? null,
      roleTemplateId: extras?.roleTemplateId ?? null,
      progressHistory: extras?.progressHistory ?? []
    }
  });
}

async function ensureDefaultGoalsForUser(userId: string, createdById: string, role?: Role) {
  const existing = await prisma.goal.count({ where: { assignedToId: userId } });
  if (existing > 0) return;

  const defaults = buildDefaultGoals(userId, createdById, role);
  await prisma.goal.createMany({ data: defaults });
}

async function main() {
  const adminEmail = 'admin@nyx.local';
  const admin = await ensureUser(adminEmail, 'Admin', Role.ADMIN, 'admin123');

  const manager = await ensureUser('manager@nyx.local', 'Sarah Chen', Role.MANAGER, 'manager123', admin.id, admin.id, {
    department: 'Creative',
    roleTemplateId: 2,
    progressHistory: []
  });
  await ensureDefaultGoalsForUser(manager.id, admin.id, Role.MANAGER);

  const employee = await ensureUser('elizabeth@nyx.local', 'Elizabeth Lum', Role.USER, 'user123', manager.id, admin.id, {
    department: 'Creative',
    roleTemplateId: 1,
    progressHistory: [
      { date: '2024-05', score: 20, tasksCompleted: 1 },
      { date: '2024-06', score: 50, tasksCompleted: 2 },
      { date: '2024-07', score: 80, tasksCompleted: 2 },
      { date: '2024-08', score: 120, tasksCompleted: 3 },
      { date: '2024-09', score: 150, tasksCompleted: 4 },
      { date: '2024-10', score: 200, tasksCompleted: 5 }
    ]
  });
  await ensureDefaultGoalsForUser(employee.id, manager.id, Role.USER);

  const existingReview = await prisma.review.findFirst({ where: { revieweeId: employee.id } });
  if (!existingReview) {
    const goalsForReview = await prisma.goal.findMany({ where: { assignedToId: employee.id }, take: 2 });
    const review = await prisma.review.create({
      data: {
        reviewerId: manager.id,
        revieweeId: employee.id,
        summary: 'Great progress on monthly tasks and clear ownership of design deliverables.',
        comments: 'Keep pushing for consistency across projects and share learnings with the team.',
        score: 85,
        meta: {
          month: new Date().toISOString().slice(0, 7),
          managerFeedback: 'Great progress on monthly tasks and clear ownership of design deliverables.',
          completedTaskIds: [],
          roleGoalProgress: []
        }
      }
    });

    if (goalsForReview.length) {
      await prisma.reviewGoal.createMany({
        data: goalsForReview.map((goal) => ({ reviewId: review.id, goalId: goal.id }))
      });
    }
  }

  const existingNotifications = await prisma.notification.count({ where: { userId: employee.id } });
  if (existingNotifications === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: employee.id,
          message: 'Your monthly tasks for this period have been assigned.',
          meta: { type: 'tasks', month: 'current' }
        },
        {
          userId: employee.id,
          message: 'Performance review summary is available.',
          meta: { type: 'review' }
        }
      ]
    });
  }

  const managerNotifications = await prisma.notification.count({ where: { userId: manager.id } });
  if (managerNotifications === 0) {
    await prisma.notification.create({
      data: {
        userId: manager.id,
        message: 'Team goals were initialized from default templates.',
        meta: { type: 'info' }
      }
    });
  }

  console.log('Seed complete: admin, manager, user, default goals, review, notifications.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
