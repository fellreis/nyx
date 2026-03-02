import { Router } from 'express';
import { register } from './register.js';
import { login } from './login.js';
import { refresh } from './refresh.js';
import { logout } from './logout.js';

const auth = Router();

auth.use(register);
auth.use(login);
auth.use(refresh);
auth.use(logout);

export { auth };
