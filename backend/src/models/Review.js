import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  audioJob: { type: mongoose.Schema.Types.ObjectId, ref: 'AudioJob', required: true, index: true },
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  decision: { type: String, enum: ['Approved', 'Returned for Correction', 'Rejected'], required: true },
  comments: { type: String, default: '' },
  segmentComments: [{
    segment: { type: mongoose.Schema.Types.ObjectId, ref: 'TranscriptionSegment' },
    comment: String
  }]
}, { timestamps: true });

export const Review = mongoose.model('Review', reviewSchema);
