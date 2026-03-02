import express from 'express';
import { security } from './middlewares/security.js';
import { auth } from './routes/auth/index.js';
import { health } from './routes/health.js';
import { goals } from './routes/goals/index.js';
import { reviews } from './routes/reviews/index.js';
import { notifications } from './routes/notifications/index.js';
import { team } from './routes/team.js';
import { users } from './routes/users/index.js';
import { templatesRouter } from './routes/templates.js';
import { requireRemoteFlag } from './middlewares/remote-flag.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(...security);
  app.use(requireRemoteFlag);

  app.use('/', auth);
  app.use('/', users);
  app.use('/', goals);
  app.use('/', reviews);
  app.use('/', team);
  app.use('/', notifications);
  app.use('/', templatesRouter);
  app.use('/', health);

  return app;
}
