import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createProject, createTag, deleteProject, deleteTag, getProject, listProjects, listTags, projectSchema, tagSchema, updateProject, updateTag } from '../controllers/projectController.js';

export const projectRoutes = Router();
projectRoutes.get('/', listProjects);
projectRoutes.get('/:id', getProject);
projectRoutes.use(authorize('admin'));
projectRoutes.post('/', validate(projectSchema), createProject);
projectRoutes.patch('/:id', updateProject);
projectRoutes.delete('/:id', deleteProject);
projectRoutes.get('/:projectId/tags', listTags);
projectRoutes.post('/:projectId/tags', validate(tagSchema), createTag);
projectRoutes.patch('/:projectId/tags/:tagId', updateTag);
projectRoutes.delete('/:projectId/tags/:tagId', deleteTag);
