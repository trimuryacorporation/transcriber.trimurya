import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createUser, deleteUser, listUsers, productivity, updateUser, userSchema } from '../controllers/userController.js';

export const userRoutes = Router();
userRoutes.get('/', authorize('admin', 'tl'), listUsers);
userRoutes.post('/', authorize('admin', 'tl'), validate(userSchema), createUser);
userRoutes.use(authorize('admin'));
userRoutes.get('/:id/productivity', productivity);
userRoutes.patch('/:id', updateUser);
userRoutes.delete('/:id', deleteUser);
