import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import { charts, dashboard, downloadReport } from '../controllers/reportController.js';

export const reportRoutes = Router();
reportRoutes.use(authorize('admin', 'tl', 'reviewer'));
reportRoutes.get('/dashboard', dashboard);
reportRoutes.get('/charts', charts);
reportRoutes.get('/download', authorize('admin', 'tl'), downloadReport);
