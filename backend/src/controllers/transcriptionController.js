import { z } from 'zod';
import { AudioJob } from '../models/AudioJob.js';
import { TranscriptionSegment } from '../models/TranscriptionSegment.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { logActivity } from '../utils/audit.js';

const tagIdSchema = z.union([
  z.string(),
  z.object({ _id: z.string() }).transform((tag) => tag._id)
]);
const transcriberEditableStatuses = ['Assigned', 'In Progress', 'Draft Saved', 'Returned for Correction', 'Rejected'];
const reviewerReadableStatuses = ['Submitted', 'Resubmitted', 'Under Review'];

function idOf(value) {
  return String(value?._id || value || '');
}

export const saveSegmentsSchema = z.object({
  body: z.object({
    lastPlaybackPosition: z.number().nonnegative().optional(),
    segments: z.array(z.object({
      _id: z.string().optional(),
      segmentNumber: z.number().int().positive(),
      startTime: z.number().nonnegative(),
      endTime: z.number().nonnegative(),
      speakerLabel: z.string().default('Speaker 1'),
      genderLabel: z.string().default('Unknown'),
      transcriptText: z.string().default(''),
      tags: z.array(tagIdSchema).default([]),
      reviewerComment: z.string().optional().default('')
    }))
  })
});

async function assertCanEdit(req, job) {
  if (!job) throw new ApiError(404, 'Audio file not found');
  if (job.status === 'Approved' && !['admin', 'tl'].includes(req.user.role)) throw new ApiError(409, 'Approved work cannot be edited');
  if (req.user.role === 'transcriber') {
    if (idOf(job.assignedTranscriber) !== idOf(req.user._id)) throw new ApiError(403, 'This file is not assigned to you');
    if (!transcriberEditableStatuses.includes(job.status)) throw new ApiError(409, 'Submitted work cannot be edited until reviewer returns or rejects it');
  }
  if (req.user.role === 'reviewer' && idOf(job.reviewer) !== idOf(req.user._id) && !reviewerReadableStatuses.includes(job.status)) throw new ApiError(403, 'This file is not assigned for your review');
}

async function assertCanView(req, job) {
  if (!job) throw new ApiError(404, 'Audio file not found');
  if (['admin', 'tl'].includes(req.user.role)) return;
  if (req.user.role === 'reviewer' && idOf(job.reviewer) === idOf(req.user._id)) return;
  if (req.user.role === 'reviewer' && reviewerReadableStatuses.includes(job.status)) return;
  if (req.user.role === 'transcriber' && idOf(job.assignedTranscriber) === idOf(req.user._id)) return;
  throw new ApiError(403, 'This file is not assigned to you');
}

export const listSegments = asyncHandler(async (req, res) => {
  const job = await AudioJob.findById(req.params.jobId);
  await assertCanView(req, job);
  const segments = await TranscriptionSegment.find({ audioJob: job._id })
    .sort('segmentNumber')
    .populate('tags')
    .populate('reviewerCommentBy', 'name loginId email role');
  res.json({ items: segments });
});

export const saveSegments = asyncHandler(async (req, res) => {
  const job = await AudioJob.findById(req.params.jobId);
  await assertCanEdit(req, job);
  const saved = [];
  for (const segment of req.body.segments) {
    if (segment.endTime <= segment.startTime) throw new ApiError(422, `Segment ${segment.segmentNumber} end time must be after start time`);
    const existing = segment._id
      ? await TranscriptionSegment.findOne({ _id: segment._id, audioJob: job._id })
      : await TranscriptionSegment.findOne({ audioJob: job._id, segmentNumber: segment.segmentNumber });
    const before = existing?.toObject();
    const doc = existing || new TranscriptionSegment({ audioJob: job._id, segmentNumber: segment.segmentNumber, createdBy: req.user._id });
    const previousReviewerComment = existing?.reviewerComment || '';
    const nextReviewerComment = segment.reviewerComment || '';
    const reviewerCommentChanged = previousReviewerComment !== nextReviewerComment;
    if (reviewerCommentChanged && !['reviewer', 'admin', 'tl'].includes(req.user.role)) {
      throw new ApiError(403, 'Only reviewers, TLs, and admins can update reviewer comments');
    }
    Object.assign(doc, segment, { audioJob: job._id, updatedBy: req.user._id });
    if (reviewerCommentChanged) {
      doc.reviewerCommentBy = nextReviewerComment ? req.user._id : undefined;
      doc.reviewerCommentAt = nextReviewerComment ? new Date() : undefined;
    }
    if (before) doc.revisions.push({ actor: req.user._id, action: 'segment_updated', before, after: segment });
    await doc.save();
    saved.push(doc);
  }
  if (typeof req.body.lastPlaybackPosition === 'number') job.lastPlaybackPosition = req.body.lastPlaybackPosition;
  if (req.user.role !== 'reviewer' && ['Assigned', 'In Progress', 'Returned for Correction', 'Rejected', 'Resubmitted'].includes(job.status)) job.status = 'Draft Saved';
  await job.save();
  await logActivity({ actor: req.user._id, action: 'draft_saved', entityType: 'AudioJob', entityId: job._id, req });
  const items = await TranscriptionSegment.find({ _id: { $in: saved.map((segment) => segment._id) } })
    .sort('segmentNumber')
    .populate('tags')
    .populate('reviewerCommentBy', 'name loginId email role');
  res.json({ items, job });
});

export const deleteSegment = asyncHandler(async (req, res) => {
  const job = await AudioJob.findById(req.params.jobId);
  await assertCanEdit(req, job);
  await TranscriptionSegment.findOneAndDelete({ _id: req.params.segmentId, audioJob: job._id });
  await logActivity({ actor: req.user._id, action: 'segment_deleted', entityType: 'AudioJob', entityId: job._id, req });
  res.json({ message: 'Segment deleted' });
});

export const submitForReview = asyncHandler(async (req, res) => {
  const job = await AudioJob.findById(req.params.jobId);
  await assertCanEdit(req, job);
  const count = await TranscriptionSegment.countDocuments({ audioJob: job._id, transcriptText: { $ne: '' } });
  if (!count) throw new ApiError(422, 'Add at least one completed segment before submitting');
  job.status = ['Returned for Correction', 'Rejected'].includes(job.status) ? 'Resubmitted' : 'Submitted';
  job.submittedAt = new Date();
  await job.save();
  const notifications = [];
  if (job.reviewer) {
    notifications.push(Notification.create({
      recipient: job.reviewer,
      title: 'Transcription submitted',
      message: `${job.originalFileName} was submitted for review.`,
      type: 'review',
      link: `/transcriber/work/${job._id}`
    }));
  }
  if (job.assignedTl) {
    notifications.push(Notification.create({
      recipient: job.assignedTl,
      title: 'Transcription submitted',
      message: `${job.originalFileName} was submitted by transcriber.`,
      type: 'review',
      link: '/admin/review'
    }));
  }
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  notifications.push(...admins.map((admin) => Notification.create({
    recipient: admin._id,
    title: 'Transcription submitted',
    message: `${job.originalFileName} is waiting for review.`,
    type: 'review',
    link: '/admin/review'
  })));
  await Promise.all(notifications);
  await logActivity({ actor: req.user._id, action: 'submitted_for_review', entityType: 'AudioJob', entityId: job._id, req });
  res.json({ job });
});
