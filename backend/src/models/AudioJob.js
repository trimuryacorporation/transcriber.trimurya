import mongoose from 'mongoose';
import { JOB_STATUSES } from '../utils/constants.js';

const audioJobSchema = new mongoose.Schema({
  originalFileName: { type: String, required: true },
  normalizedFileName: { type: String, required: true, index: true },
  r2ObjectKey: { type: String, required: true, unique: true },
  fileSize: { type: Number, required: true },
  mimeType: { type: String, required: true },
  duration: { type: Number, default: 0 },
  checksum: { type: String, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  language: { type: String, required: true },
  assignedTl: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedTranscriber: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tlAssignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tlAssignedAt: Date,
  transcriberAssignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  transcriberAssignedAt: Date,
  reviewerAssignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewerAssignedAt: Date,
  priority: { type: String, enum: ['Low', 'Normal', 'High', 'Urgent'], default: 'Normal' },
  deadline: Date,
  status: { type: String, enum: JOB_STATUSES, default: 'Unassigned', index: true },
  lastPlaybackPosition: { type: Number, default: 0 },
  startedAt: Date,
  submittedAt: Date,
  approvedAt: Date,
  archivedAt: Date,
  replacedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'AudioJob' },
  metadata: {
    format: String,
    uploadId: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}, { timestamps: true });

audioJobSchema.index({ project: 1, status: 1 });
audioJobSchema.index({ assignedTl: 1, status: 1 });
audioJobSchema.index({ assignedTranscriber: 1, status: 1 });
audioJobSchema.index({ checksum: 1, fileSize: 1, project: 1 });

export const AudioJob = mongoose.model('AudioJob', audioJobSchema);
