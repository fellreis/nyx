type Template = {
  id: number;
  name: string;
  role: string;
  level: string;
  goals: Array<{
    title: string;
    description: string;
    points: number;
    isPromotionBlocker?: boolean;
    subtasks?: string[];
  }>;
};

const defaultTemplateGoals = [
  {
    title: 'Complete onboarding training',
    description: 'Finish all mandatory company and role-specific onboarding modules.',
    points: 8
  },
  {
    title: 'Schedule first 1:1 with manager',
    description: 'Align expectations and career objectives for the quarter.',
    points: 8
  },
  {
    title: 'Have a conversation with the Senior marketing managers to understand the purpose of the Brief',
    description: 'Creative Strategy task',
    points: 40
  },
  {
    title: 'Complete brief analysis before any design work begins',
    description: 'Creative Strategy task',
    points: 40
  },
  {
    title: 'Get brief approval from supervisor before proceeding to concepts',
    description: 'Creative Strategy task',
    points: 40
  },
  {
    title: 'Document how each design element supports the objective',
    description: 'Creative Strategy task',
    points: 40
  },
  {
    title: 'Spend minimum 20% of project time on research and strategy',
    description: 'Strategic Research task',
    points: 20
  },
  {
    title: 'Analyze target audience behavior and preferences',
    description: 'Strategic Research task',
    points: 20
  },
  {
    title: 'Study successful campaigns in similar categories',
    description: 'Strategic Research task',
    points: 20
  },
  {
    title: 'Create competitive analysis for major projects',
    description: 'Strategic Research task',
    points: 20
  },
  {
    title: 'Generate minimum 3 distinct creative territories per project',
    description: 'Concept Development task',
    points: 20
  },
  {
    title: 'Present concepts with strategic rationale, not just aesthetic appeal',
    description: 'Concept Development task',
    points: 20
  },
  {
    title: 'Link every creative decision to business/communication objectives',
    description: 'Concept Development task',
    points: 20
  },
  {
    title: 'Test concepts against success criteria before final development',
    description: 'Concept Development task',
    points: 20
  },
  {
    title: 'Complete comprehensive role orientation covering new responsibilities',
    description: '90-Day Plan task',
    points: 20
  },
  {
    title: 'Review and understand brand guidelines for all assigned clients/projects',
    description: '90-Day Plan task',
    points: 20
  },
  {
    title: 'Establish working relationships with key stakeholders',
    description: '90-Day Plan task',
    points: 20
  },
  {
    title: 'Complete Creative Direction Short Course at Central Saint Martins',
    description: '90-Day Plan task',
    points: 20
  },
  {
    title: 'Implement team-wide creative brief process',
    description: '90-Day Plan task',
    points: 20
  },
  {
    title: 'Complete a creative brief analysis for every project before starting',
    description: 'Creative Excellence task',
    points: 20
  },
  {
    title: 'Create content audit checklist for each project',
    description: 'Creative Excellence task',
    points: 20
  },
  {
    title: 'Develop 5+ original, concept-driven design solutions per month',
    description: 'Creative Excellence task',
    points: 20
  },
  {
    title: 'Maintain 95% client approval rate on strategic presentations',
    description: 'Creative Excellence task',
    points: 20
  },
  {
    title: 'Manage 8–12 concurrent projects with varying deadlines',
    description: 'Project Management task',
    points: 10
  },
  {
    title: 'Deliver 100% of projects on time and within budget',
    description: 'Project Management task',
    points: 10
  },
  {
    title: 'Develop project timelines and communicate progress to stakeholders',
    description: 'Project Management task',
    points: 10
  },
  {
    title: 'Provide design guidance to 1–2 junior team members',
    description: 'Team Leadership task',
    points: 10
  },
  {
    title: 'Continue excellent management of Max and Thiago',
    description: 'Team Leadership task',
    points: 10
  },
  {
    title: 'Lead strategic creative sessions with the team',
    description: 'Team Leadership task',
    points: 10
  },
  {
    title: 'Master React Fundamentals',
    description: 'Complete advanced React course on a platform like Coursera or Udemy.',
    points: 50,
    isPromotionBlocker: false
  },
  {
    title: 'Component Library Contribution',
    description: 'Contribute 5 new, well-documented components to the shared component library.',
    points: 100,
    isPromotionBlocker: true
  }
];

export const templates: Template[] = [
  {
    id: 1,
    name: 'Default Employee Goals',
    role: 'General',
    level: 'Standard',
    goals: defaultTemplateGoals
  }
];
