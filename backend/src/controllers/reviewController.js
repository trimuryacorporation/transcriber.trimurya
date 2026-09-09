import { z } from 'zod';
import { AudioJob } from '../models/AudioJob.js';
import { Review } from '../models/Review.js';
import { TranscriptionSegment } from '../models/TranscriptionSegment.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { logActivity } from '../utils/audit.js';

function idOf(value) {
  return String(value?._id || value || '');
}

function canReviewerHandle(user, job) {
  if (user.role !== 'reviewer') return true;
  return idOf(job.reviewer) === idOf(user._id) || ['Submitted', 'Resubmitted', 'Under Review'].includes(job.status);
}

export const reviewSchema = z.object({
  body: z.object({
    decision: z.enum(['Approved', 'Returned for Correction', 'Rejected']),
    comments: z.string().optional().default(''),
    segmentComments: z.array(z.object({ segment: z.string(), comment: z.string() })).optional().default([])
  })
});

export const startReview = asyncHandler(async (req, res) => {
  const job = await AudioJob.findById(req.params.jobId);
  if (!job) throw new ApiError(404, 'Audio file not found');
  if (!canReviewerHandle(req.user, job)) throw new ApiError(403, 'This review is not assigned to you');
  if (!['Submitted', 'Resubmitted', 'Under Review'].includes(job.status)) throw new ApiError(409, 'Only submitted jobs can be reviewed');
  if (req.user.role === 'reviewer' && !job.reviewer) {
    job.reviewer = req.user._id;
    job.reviewerAssignedAt = new Date();
  }
  job.status = 'Under Review';
  await job.save();
  res.json({ job });
});

export const completeReview = asyncHandler(async (req, res) => {
  const job = await AudioJob.findById(req.params.jobId);
  if (!job) throw new ApiError(404, 'Audio file not found');
  if (!canReviewerHandle(req.user, job)) throw new ApiError(403, 'This review is not assigned to you');
  if (req.user.role === 'reviewer' && !job.reviewer) {
    job.reviewer = req.user._id;
    job.reviewerAssignedAt = new Date();
  }
  const review = await Review.create({ audioJob: job._id, reviewer: req.user._id, ...req.body });
  for (const item of req.body.segmentComments) {
    await TranscriptionSegment.findByIdAndUpdate(item.segment, {
      reviewerComment: item.comment,
      reviewerCommentBy: req.user._id,
      reviewerCommentAt: new Date(),
      updatedBy: req.user._id
    });
  }
  job.status = req.body.decision;
  if (req.body.decision === 'Approved') job.approvedAt = new Date();
  await job.save();
  if (job.assignedTranscriber) {
    await Notification.create({
      recipient: job.assignedTranscriber,
      title: `Transcription ${req.body.decision}`,
      message: req.body.comments || `Your work for ${job.originalFileName} was ${req.body.decision.toLowerCase()}.`,
      type: 'review',
      link: `/transcriber/work/${job._id}`
    });
  }
  const tlRecipientIds = [
    job.assignedTl,
    job.transcriberAssignedBy,
    job.reviewerAssignedBy
  ].filter(Boolean).map((id) => String(id));
  const tls = await User.find({ _id: { $in: [...new Set(tlRecipientIds)] }, role: 'tl', isActive: true }).select('_id');
  await Promise.all(tls.map((tl) => Notification.create({
    recipient: tl._id,
    title: 'Reviewer sent work',
    message: `${job.originalFileName} was marked ${req.body.decision} by reviewer.`,
    type: 'review',
    link: '/admin/review'
  })));
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  await Promise.all(admins.map((admin) => Notification.create({
    recipient: admin._id,
    title: 'Reviewer sent work',
    message: `${job.originalFileName} was marked ${req.body.decision} by reviewer.`,
    type: 'review',
    link: '/admin/review'
  })));
  await logActivity({ actor: req.user._id, action: 'review_completed', entityType: 'Review', entityId: review._id, metadata: { decision: req.body.decision }, req });
  res.status(201).json({ review, job });
});

export const listReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ audioJob: req.params.jobId }).populate('reviewer', 'name loginId email role').sort('-createdAt');
  res.json({ items: reviews });
});
