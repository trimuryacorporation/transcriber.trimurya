import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { readSettings, settingsSchema, updateSettings } from '../controllers/settingsController.js';

export const settingsRoutes = Router();

settingsRoutes.get('/', authorize('admin', 'tl'), readSettings);
settingsRoutes.patch('/', authorize('admin'), validate(settingsSchema), updateSettings);

