import { GoalType, Role } from '@prisma/client';

type GoalTemplate = {
  title: string;
  description?: string;
  type: GoalType;
  points: number;
  role?: Role;
  meta?: {
    category?: string;
    reviewPeriod?: string;
    isPromotionBlocker?: boolean;
    progress?: number;
    uiStatus?: string;
  };
};

const monthlyCategories: Array<{ category: string; points: number; items: string[] }> = [
  {
    category: 'Creative Strategy',
    points: 40,
    items: [
      'Have a conversation with the Senior marketing managers to understand the purpose of the Brief',
      'Complete brief analysis before any design work begins',
      'Get brief approval from supervisor before proceeding to concepts',
      'Document how each design element supports the objective'
    ]
  },
  {
    category: 'Strategic Research',
    points: 20,
    items: [
      'Spend minimum 20% of project time on research and strategy',
      'Analyze target audience behavior and preferences',
      'Study successful campaigns in similar categories',
      'Create competitive analysis for major projects'
    ]
  },
  {
    category: 'Concept Development',
    points: 20,
    items: [
      'Generate minimum 3 distinct creative territories per project',
      'Present concepts with strategic rationale, not just aesthetic appeal',
      'Link every creative decision to business/communication objectives',
      'Test concepts against success criteria before final development'
    ]
  },
  {
    category: '90-Day Plan',
    points: 20,
    items: [
      'Complete comprehensive role orientation covering new responsibilities',
      'Review and understand brand guidelines for all assigned clients/projects',
      'Establish working relationships with key stakeholders',
      'Complete Creative Direction Short Course at Central Saint Martins',
      'Implement team-wide creative brief process'
    ]
  },
  {
    category: 'Creative Excellence',
    points: 20,
    items: [
      'Complete a creative brief analysis for every project before starting',
      'Create content audit checklist for each project',
      'Develop 5+ original, concept-driven design solutions per month',
      'Maintain 95% client approval rate on strategic presentations'
    ]
  },
  {
    category: 'Project Management',
    points: 10,
    items: [
      'Manage 8–12 concurrent projects with varying deadlines',
      'Deliver 100% of projects on time and within budget',
      'Develop project timelines and communicate progress to stakeholders'
    ]
  },
  {
    category: 'Team Leadership',
    points: 10,
    items: [
      'Provide design guidance to 1–2 junior team members',
      'Continue excellent management of Max and Thiago',
      'Lead strategic creative sessions with the team'
    ]
  }
];

const roleGoals: GoalTemplate[] = [
  {
    title: 'Master React Fundamentals',
    description: 'Complete advanced React course on a platform like Coursera or Udemy.',
    type: GoalType.ROLE,
    points: 50,
    meta: { isPromotionBlocker: false }
  },
  {
    title: 'Component Library Contribution',
    description: 'Contribute 5 new, well-documented components to the shared component library.',
    type: GoalType.ROLE,
    points: 100,
    meta: { isPromotionBlocker: true }
  }
];

const basicGoals: GoalTemplate[] = [
  {
    title: 'Complete onboarding training',
    description: 'Finish all mandatory company and role-specific onboarding modules.',
    type: GoalType.BASIC,
    points: 8
  },
  {
    title: 'Schedule first 1:1 with manager',
    description: 'Align expectations and career objectives for the quarter.',
    type: GoalType.BASIC,
    points: 8
  }
];

export function buildDefaultGoals(assignedToId: string, createdById: string, role?: Role) {
  const reviewPeriod = new Date().toISOString().slice(0, 7);
  const monthly: GoalTemplate[] = monthlyCategories.flatMap((category) =>
    category.items.map((item) => ({
      title: item,
      description: `${category.category} task`,
      type: GoalType.MONTHLY,
      points: category.points,
      role,
      meta: {
        category: category.category,
        reviewPeriod,
        progress: 0,
        uiStatus: 'Not Started'
      }
    }))
  );

  const goals: GoalTemplate[] = [
    ...basicGoals.map((goal) => ({ ...goal, meta: { progress: 0, uiStatus: 'Not Started' } })),
    ...monthly,
    ...roleGoals.map((goal) => ({ ...goal, meta: { ...goal.meta, progress: 0, uiStatus: 'Not Started' } }))
  ];

  return goals.map((goal) => ({
    title: goal.title,
    description: goal.description,
    type: goal.type,
    points: goal.points,
    role: goal.role,
    meta: goal.meta ?? undefined,
    assignedToId,
    createdById
  }));
}
