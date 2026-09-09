import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authRoutes } from './authRoutes.js';
import { userRoutes } from './userRoutes.js';
import { projectRoutes } from './projectRoutes.js';
import { audioRoutes } from './audioRoutes.js';
import { transcriptionRoutes } from './transcriptionRoutes.js';
import { reviewRoutes } from './reviewRoutes.js';
import { reportRoutes } from './reportRoutes.js';
import { settingsRoutes } from './settingsRoutes.js';
import { miscRoutes } from './miscRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use(authenticate);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/audio', audioRoutes);
router.use('/transcriptions', transcriptionRoutes);
router.use('/reviews', reviewRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', settingsRoutes);
router.use('/', miscRoutes);

export default router;
