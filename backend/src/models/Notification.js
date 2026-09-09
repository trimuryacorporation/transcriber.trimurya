import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['assignment', 'review', 'system'], default: 'system' },
  readAt: Date,
  link: String
}, { timestamps: true });

export const Notification = mongoose.model('Notification', notificationSchema);
