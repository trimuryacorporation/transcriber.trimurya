import { z } from 'zod';
import { User } from '../models/User.js';
import { AudioJob } from '../models/AudioJob.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { paginate, sortFromQuery } from '../utils/pagination.js';
import { logActivity } from '../utils/audit.js';
import { getAppSettings } from './settingsController.js';

export const userSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    loginId: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8).optional(),
    role: z.enum(['admin', 'tl', 'transcriber', 'reviewer']).default('transcriber'),
    isActive: z.boolean().optional(),
    languages: z.array(z.string()).optional()
  })
});

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.active) filter.isActive = req.query.active === 'true';
  if (req.query.search) filter.$or = [
    { name: new RegExp(req.query.search, 'i') },
    { email: new RegExp(req.query.search, 'i') }
  ];
  const [items, total] = await Promise.all([
    User.find(filter).sort(sortFromQuery(req)).skip(skip).limit(limit),
    User.countDocuments(filter)
  ]);
  res.json({ items, page, limit, total });
});

export const createUser = asyncHandler(async (req, res) => {
  if (req.user.role === 'tl') {
    const settings = await getAppSettings();
    if (!settings.allowTlTeamCreate) throw new ApiError(403, 'TL user creation is disabled');
    if (!['transcriber', 'reviewer'].includes(req.body.role)) throw new ApiError(403, 'TL can only create transcribers and reviewers');
  }
  const exists = await User.exists({ $or: [{ email: req.body.email.toLowerCase() }, { loginId: req.body.loginId.trim() }] });
  if (exists) throw new ApiError(409, 'A user with this email or login ID already exists');
  const passwordHash = await User.hashPassword(req.body.password || 'ChangeMe123!');
  const email = req.body.email.toLowerCase();
  const user = await User.create({ ...req.body, email, loginId: req.body.loginId.trim(), passwordHash });
  await logActivity({ actor: req.user._id, action: 'user_created', entityType: 'User', entityId: user._id, req });
  res.status(201).json({ user });
});

export const updateUser = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (payload.password) {
    payload.passwordHash = await User.hashPassword(payload.password);
    delete payload.password;
  }
  const user = await User.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!user) throw new ApiError(404, 'User not found');
  await logActivity({ actor: req.user._id, action: 'user_updated', entityType: 'User', entityId: user._id, req });
  res.json({ user });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const hasJobs = await AudioJob.exists({ $or: [{ assignedTl: req.params.id }, { assignedTranscriber: req.params.id }, { reviewer: req.params.id }] });
  if (hasJobs) throw new ApiError(400, 'Deactivate users with job history instead of deleting them');
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  await logActivity({ actor: req.user._id, action: 'user_deleted', entityType: 'User', entityId: user._id, req });
  res.json({ message: 'User deleted' });
});

export const productivity = asyncHandler(async (req, res) => {
  const matchUser = req.params.id ? new mongoose.Types.ObjectId(req.params.id) : { $exists: true };
  const rows = await AudioJob.aggregate([
    { $match: { assignedTranscriber: matchUser, status: 'Approved' } },
    { $group: { _id: '$assignedTranscriber', completedJobs: { $sum: 1 }, completedDuration: { $sum: '$duration' } } }
  ]);
  res.json({ items: rows });
});
