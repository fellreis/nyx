import { Router } from 'express';
import { getMe } from './me.js';
import { getUser } from './get-user.js';
import { listUsers } from './list.js';
import { patchUserPassword } from './patch-password.js';
import { patchUser } from './patch-user.js';

const users = Router();

users.use(getMe);
users.use(getUser);
users.use(listUsers);
users.use(patchUserPassword);
users.use(patchUser);

export { users };
