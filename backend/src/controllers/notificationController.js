import { Notification } from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const items = await Notification.find({ recipient: req.user._id }).sort('-createdAt').limit(50);
  res.json({ items });
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { readAt: new Date() },
    { new: true }
  );
  res.json({ notification });
});

export const clearNotifications = asyncHandler(async (req, res) => {
  const result = await Notification.deleteMany({ recipient: req.user._id });
  res.json({ deleted: result.deletedCount });
});
