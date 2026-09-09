import { z } from 'zod';
import { Project } from '../models/Project.js';
import { TagDefinition } from '../models/TagDefinition.js';
import { AudioJob } from '../models/AudioJob.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { paginate, sortFromQuery } from '../utils/pagination.js';
import { logActivity } from '../utils/audit.js';

export const projectSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    client: z.string().optional().default(''),
    description: z.string().optional().default(''),
    language: z.string().min(2),
    guidelines: z.string().optional().default(''),
    speakers: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    genders: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    rules: z.object({
      millisecondPrecision: z.boolean().optional(),
      timestampBufferSeconds: z.number().optional(),
      minSegmentSeconds: z.number().optional(),
      maxSegmentSeconds: z.number().optional(),
      newSegmentOnSpeakerChange: z.boolean().optional(),
      silenceWarningSeconds: z.number().optional(),
      handleOverlappingSpeechSeparately: z.boolean().optional(),
      ignoreBackgroundVoices: z.boolean().optional(),
      verbatim: z.boolean().optional()
    }).optional(),
    isActive: z.boolean().optional()
  })
});

export const tagSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    color: z.string().optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional()
  })
});

export const listProjects = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const filter = {};
  if (req.query.search) filter.$or = [
    { name: new RegExp(req.query.search, 'i') },
    { client: new RegExp(req.query.search, 'i') },
    { language: new RegExp(req.query.search, 'i') }
  ];
  if (req.query.active) filter.isActive = req.query.active === 'true';
  const [items, total] = await Promise.all([
    Project.find(filter).sort(sortFromQuery(req)).skip(skip).limit(limit),
    Project.countDocuments(filter)
  ]);
  res.json({ items, page, limit, total });
});

export const createProject = asyncHandler(async (req, res) => {
  const project = await Project.create(req.body);
  await logActivity({ actor: req.user._id, action: 'project_created', entityType: 'Project', entityId: project._id, req });
  res.status(201).json({ project });
});

export const getProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw new ApiError(404, 'Project not found');
  const tags = await TagDefinition.find({ project: project._id, isActive: true }).sort('name');
  res.json({ project, tags });
});

export const updateProject = asyncHandler(async (req, res) => {
  const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!project) throw new ApiError(404, 'Project not found');
  await logActivity({ actor: req.user._id, action: 'project_updated', entityType: 'Project', entityId: project._id, req });
  res.json({ project });
});

export const deleteProject = asyncHandler(async (req, res) => {
  if (await AudioJob.exists({ project: req.params.id })) throw new ApiError(400, 'Archive projects that already contain audio jobs');
  const project = await Project.findByIdAndDelete(req.params.id);
  if (!project) throw new ApiError(404, 'Project not found');
  await logActivity({ actor: req.user._id, action: 'project_deleted', entityType: 'Project', entityId: project._id, req });
  res.json({ message: 'Project deleted' });
});

export const listTags = asyncHandler(async (req, res) => {
  const tags = await TagDefinition.find({ project: req.params.projectId }).sort('name');
  res.json({ items: tags });
});

export const createTag = asyncHandler(async (req, res) => {
  const tag = await TagDefinition.create({ ...req.body, project: req.params.projectId });
  await logActivity({ actor: req.user._id, action: 'tag_created', entityType: 'TagDefinition', entityId: tag._id, req });
  res.status(201).json({ tag });
});

export const updateTag = asyncHandler(async (req, res) => {
  const tag = await TagDefinition.findByIdAndUpdate(req.params.tagId, req.body, { new: true, runValidators: true });
  if (!tag) throw new ApiError(404, 'Tag not found');
  res.json({ tag });
});

export const deleteTag = asyncHandler(async (req, res) => {
  const tag = await TagDefinition.findByIdAndUpdate(req.params.tagId, { isActive: false }, { new: true });
  if (!tag) throw new ApiError(404, 'Tag not found');
  res.json({ tag });
});
