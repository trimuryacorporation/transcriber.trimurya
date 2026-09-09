import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { completeReview, listReviews, reviewSchema, startReview } from '../controllers/reviewController.js';

export const reviewRoutes = Router();
reviewRoutes.use(authorize('admin', 'tl', 'reviewer'));
reviewRoutes.get('/:jobId', listReviews);
reviewRoutes.post('/:jobId/start', startReview);
reviewRoutes.post('/:jobId/complete', validate(reviewSchema), completeReview);
