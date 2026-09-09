import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { changePassword, changePasswordSchema, forgotPassword, login, loginSchema, logout, me } from '../controllers/authController.js';

export const authRoutes = Router();
authRoutes.post('/login', validate(loginSchema), login);
authRoutes.post('/forgot-password', forgotPassword);
authRoutes.post('/logout', logout);
authRoutes.get('/me', authenticate, me);
authRoutes.patch('/password', authenticate, validate(changePasswordSchema), changePassword);
