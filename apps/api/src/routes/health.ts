import { Router, type Request, type Response } from 'express';

export const health = Router();

health.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'nyx-api', ts: new Date().toISOString() });
});
