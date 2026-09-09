import { ActivityLog } from '../models/ActivityLog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { paginate } from '../utils/pagination.js';

export const listActivity = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const filter = {};
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.action) filter.action = new RegExp(req.query.action, 'i');
  const [items, total] = await Promise.all([
    ActivityLog.find(filter).populate('actor', 'name email').sort('-createdAt').skip(skip).limit(limit),
    ActivityLog.countDocuments(filter)
  ]);
  res.json({ items, page, limit, total });
});
