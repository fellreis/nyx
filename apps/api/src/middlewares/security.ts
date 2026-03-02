import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { ENV } from '../config/env.js';

export const security = [
  helmet(),
  cors({ origin: ENV.CORS_ORIGIN, credentials: true }),
  morgan('dev')
];
