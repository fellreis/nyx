import { Router, type Response } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { templates } from '../lib/templates.js';

const templatesRouter = Router();

templatesRouter.get('/templates', authenticate, async (_req, res: Response) => {
  return res.json({ items: templates });
});

export { templatesRouter };
