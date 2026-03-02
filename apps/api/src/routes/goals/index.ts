import { Router } from 'express';
import { createGoal } from './create.js';
import { listGoals } from './list.js';
import { updateGoal } from './update.js';
import { completeGoal } from './complete.js';
import { deleteGoal } from './delete.js';

const goals = Router();

goals.use(createGoal);
goals.use(listGoals);
goals.use(updateGoal);
goals.use(completeGoal);
goals.use(deleteGoal);

export { goals };
