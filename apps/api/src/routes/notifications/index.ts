import { Router } from 'express';
import { listNotifications } from './list.js';
import { markNotificationRead } from './mark-read.js';

const notifications = Router();

notifications.use(listNotifications);
notifications.use(markNotificationRead);

export { notifications };
