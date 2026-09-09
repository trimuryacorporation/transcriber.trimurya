import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { deleteSegment, listSegments, saveSegments, saveSegmentsSchema, submitForReview } from '../controllers/transcriptionController.js';

export const transcriptionRoutes = Router();
transcriptionRoutes.get('/:jobId/segments', listSegments);
transcriptionRoutes.put('/:jobId/segments', validate(saveSegmentsSchema), saveSegments);
transcriptionRoutes.delete('/:jobId/segments/:segmentId', deleteSegment);
transcriptionRoutes.post('/:jobId/submit', submitForReview);
