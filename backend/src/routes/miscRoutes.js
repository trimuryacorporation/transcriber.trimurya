import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import { listActivity } from '../controllers/activityController.js';
import { clearNotifications, listNotifications, markRead } from '../controllers/notificationController.js';
import { exportJob } from '../controllers/exportController.js';

export const miscRoutes = Router();
miscRoutes.get('/notifications', listNotifications);
miscRoutes.post('/notifications/clear', clearNotifications);
miscRoutes.delete('/notifications', clearNotifications);
miscRoutes.patch('/notifications/:id/read', markRead);
miscRoutes.get('/activity', authorize('admin'), listActivity);
miscRoutes.get('/exports/:jobId/:format', authorize('admin', 'tl', 'reviewer'), exportJob);
