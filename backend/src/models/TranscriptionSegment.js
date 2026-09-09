import mongoose from 'mongoose';

const revisionSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: String,
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const segmentSchema = new mongoose.Schema({
  audioJob: { type: mongoose.Schema.Types.ObjectId, ref: 'AudioJob', required: true, index: true },
  segmentNumber: { type: Number, required: true },
  startTime: { type: Number, required: true },
  endTime: { type: Number, required: true },
  speakerLabel: { type: String, default: 'Speaker 1' },
  genderLabel: { type: String, default: 'Unknown' },
  transcriptText: { type: String, default: '' },
  tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TagDefinition' }],
  reviewerComment: { type: String, default: '' },
  reviewerCommentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewerCommentAt: Date,
  revisions: [revisionSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

segmentSchema.index({ audioJob: 1, segmentNumber: 1 }, { unique: true });

export const TranscriptionSegment = mongoose.model('TranscriptionSegment', segmentSchema);
