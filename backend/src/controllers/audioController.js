import { z } from 'zod';
import { nanoid } from 'nanoid';
import fs from 'node:fs';
import { Upload } from '@aws-sdk/lib-storage';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  UploadPartCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2, bucket, audioPrefix, getStorageInfo } from '../config/r2.js';
import { AudioJob } from '../models/AudioJob.js';
import { Review } from '../models/Review.js';
import { TranscriptionSegment } from '../models/TranscriptionSegment.js';
import { User } from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { AUDIO_MIME_TYPES } from '../utils/constants.js';
import { paginate, sortFromQuery } from '../utils/pagination.js';
import { logActivity } from '../utils/audit.js';

const reviewerReadableStatuses = ['Submitted', 'Resubmitted', 'Under Review'];

function idOf(value) {
  return String(value?._id || value || '');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const initiateUploadSchema = z.object({
  body: z.object({
    files: z.array(z.object({
      fileName: z.string().min(1),
      fileSize: z.number().positive(),
      mimeType: z.string().min(1),
      duration: z.number().nonnegative().optional().default(0),
      checksum: z.string().optional(),
      project: z.string().min(1),
      language: z.string().min(1),
      priority: z.enum(['Low', 'Normal', 'High', 'Urgent']).default('Normal'),
      deadline: z.string().optional(),
      assignedTl: z.string().optional(),
      assignedTranscriber: z.string().optional(),
      reviewer: z.string().optional(),
      partCount: z.number().int().min(1).max(10000).default(1)
    })).min(1)
  })
});

export const completeUploadSchema = z.object({
  body: z.object({
    uploadToken: z.string(),
    uploadId: z.string().optional(),
    parts: z.array(z.object({ ETag: z.string(), PartNumber: z.number() })).optional(),
    metadata: z.object({
      fileName: z.string().min(1),
      fileSize: z.number().positive(),
      mimeType: z.string().min(1),
      duration: z.number().nonnegative().optional().default(0),
      checksum: z.string().optional(),
      project: z.string().min(1),
      language: z.string().min(1),
      assignedTl: z.string().optional(),
      assignedTranscriber: z.string().optional(),
      reviewer: z.string().optional(),
      priority: z.enum(['Low', 'Normal', 'High', 'Urgent']).optional().default('Normal'),
      deadline: z.string().optional()
    })
  })
});

function normalizeName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

function extension(name) {
  return name.split('.').pop()?.toLowerCase() || 'audio';
}

function assertAudio(mimeType, fileName) {
  const ext = extension(fileName);
  const allowedExts = ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg'];
  if (!AUDIO_MIME_TYPES.includes(mimeType) && !allowedExts.includes(ext)) {
    throw new ApiError(422, `${fileName} is not a supported audio format`);
  }
}

async function canAccessJob(user, job) {
  if (['admin', 'tl'].includes(user.role)) return true;
  if (user.role === 'reviewer') {
    if (idOf(job.reviewer) === idOf(user._id)) return true;
    return reviewerReadableStatuses.includes(job.status);
  }
  return idOf(job.assignedTranscriber) === idOf(user._id);
}

export const initiateUpload = asyncHandler(async (req, res) => {
  const uploads = [];
  for (const file of req.body.files) {
    assertAudio(file.mimeType, file.fileName);
    if (file.checksum) {
      const duplicate = await AudioJob.exists({ checksum: file.checksum, fileSize: file.fileSize, project: file.project, status: { $ne: 'Archived' } });
      if (duplicate) throw new ApiError(409, `Duplicate file detected: ${file.fileName}`);
    }
    const objectKey = `${audioPrefix}/${file.project}/${Date.now()}-${nanoid(10)}.${extension(file.fileName)}`;
    const metadata = {
      originalFileName: encodeURIComponent(file.fileName),
      uploadedBy: String(req.user._id)
    };
    if (file.partCount > 1) {
      const create = await r2.send(new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: file.mimeType,
        Metadata: metadata
      }));
      const urls = await Promise.all(Array.from({ length: file.partCount }, async (_, index) => ({
        partNumber: index + 1,
        url: await getSignedUrl(r2, new UploadPartCommand({
          Bucket: bucket,
          Key: objectKey,
          UploadId: create.UploadId,
          PartNumber: index + 1
        }), { expiresIn: 60 * 15 })
      })));
      uploads.push({ uploadToken: objectKey, uploadId: create.UploadId, multipart: true, urls, file });
    } else {
      const url = await getSignedUrl(r2, new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: file.mimeType,
        Metadata: metadata
      }), { expiresIn: 60 * 15 });
      uploads.push({ uploadToken: objectKey, multipart: false, url, file });
    }
  }
  res.json({ uploads });
});

export const completeUpload = asyncHandler(async (req, res) => {
  const upload = req.body.uploadToken;
  if (req.body.uploadId && req.body.parts?.length) {
    await r2.send(new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: upload,
      UploadId: req.body.uploadId,
      MultipartUpload: { Parts: req.body.parts.sort((a, b) => a.PartNumber - b.PartNumber) }
    }));
  }
  const meta = req.body.metadata || {};
  const job = await AudioJob.create({
    originalFileName: meta.fileName,
    normalizedFileName: normalizeName(meta.fileName),
    r2ObjectKey: upload,
    fileSize: meta.fileSize,
    mimeType: meta.mimeType,
    duration: meta.duration || 0,
    checksum: meta.checksum,
    project: meta.project,
    language: meta.language,
    assignedTl: meta.assignedTl || undefined,
    assignedTranscriber: meta.assignedTranscriber || undefined,
    reviewer: meta.reviewer || undefined,
    tlAssignedBy: meta.assignedTl ? req.user._id : undefined,
    tlAssignedAt: meta.assignedTl ? new Date() : undefined,
    transcriberAssignedBy: meta.assignedTranscriber ? req.user._id : undefined,
    transcriberAssignedAt: meta.assignedTranscriber ? new Date() : undefined,
    reviewerAssignedBy: meta.reviewer ? req.user._id : undefined,
    reviewerAssignedAt: meta.reviewer ? new Date() : undefined,
    priority: meta.priority || 'Normal',
    deadline: meta.deadline ? new Date(meta.deadline) : undefined,
    status: meta.assignedTranscriber ? 'Assigned' : 'Unassigned',
    metadata: { format: extension(meta.fileName), uploadedBy: req.user._id }
  });
  await notifyAssignees(job);
  await logActivity({ actor: req.user._id, action: 'audio_uploaded', entityType: 'AudioJob', entityId: job._id, metadata: { fileName: job.originalFileName }, req });
  res.status(201).json({ job });
});

export const abortUpload = asyncHandler(async (req, res) => {
  await r2.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: req.body.uploadToken, UploadId: req.body.uploadId }));
  res.json({ message: 'Upload aborted' });
});

export const storageConfig = asyncHandler(async (_req, res) => {
  res.json(getStorageInfo());
});

export const directUpload = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) throw new ApiError(422, 'Select at least one audio file');
  if (!req.body.project) throw new ApiError(422, 'Project is required');
  if (!req.body.language) throw new ApiError(422, 'Language is required');

  const jobs = [];
  try {
    for (const file of files) {
      assertAudio(file.mimetype, file.originalname);
      const duplicate = await AudioJob.exists({
        originalFileName: file.originalname,
        fileSize: file.size,
        project: req.body.project,
        status: { $ne: 'Archived' }
      });
      if (duplicate) throw new ApiError(409, `Duplicate file detected: ${file.originalname}`);

      const objectKey = `${audioPrefix}/${req.body.project}/${Date.now()}-${nanoid(10)}.${extension(file.originalname)}`;
      try {
        await new Upload({
          client: r2,
          params: {
            Bucket: bucket,
            Key: objectKey,
            Body: fs.createReadStream(file.path),
            ContentType: file.mimetype || 'application/octet-stream',
            Metadata: {
              originalFileName: encodeURIComponent(file.originalname),
              uploadedBy: String(req.user._id)
            }
          },
          queueSize: 4,
          partSize: 10 * 1024 * 1024,
          leavePartsOnError: false
        }).done();
      } catch (error) {
        const status = error.$metadata?.httpStatusCode;
        const reason = [error.name, error.message, status ? `HTTP ${status}` : null].filter(Boolean).join(' - ');
        throw new ApiError(502, `Cloudflare R2 upload failed for ${file.originalname}: ${reason}`);
      }

      const job = await AudioJob.create({
        originalFileName: file.originalname,
        normalizedFileName: normalizeName(file.originalname),
        r2ObjectKey: objectKey,
        fileSize: file.size,
        mimeType: file.mimetype || 'application/octet-stream',
        duration: Number(req.body[`duration_${file.originalname}`] || req.body.duration || 0),
        project: req.body.project,
        language: req.body.language,
        assignedTl: req.body.assignedTl || undefined,
        assignedTranscriber: req.body.assignedTranscriber || undefined,
        reviewer: req.body.reviewer || undefined,
        tlAssignedBy: req.body.assignedTl ? req.user._id : undefined,
        tlAssignedAt: req.body.assignedTl ? new Date() : undefined,
        transcriberAssignedBy: req.body.assignedTranscriber ? req.user._id : undefined,
        transcriberAssignedAt: req.body.assignedTranscriber ? new Date() : undefined,
        reviewerAssignedBy: req.body.reviewer ? req.user._id : undefined,
        reviewerAssignedAt: req.body.reviewer ? new Date() : undefined,
        priority: req.body.priority || 'Normal',
        deadline: req.body.deadline ? new Date(req.body.deadline) : undefined,
        status: req.body.assignedTranscriber ? 'Assigned' : 'Unassigned',
        metadata: { format: extension(file.originalname), uploadedBy: req.user._id }
      });
      await notifyAssignees(job);
      await logActivity({ actor: req.user._id, action: 'audio_uploaded', entityType: 'AudioJob', entityId: job._id, metadata: { fileName: job.originalFileName }, req });
      jobs.push(job);
    }
  } finally {
    await Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => {})));
  }
  res.status(201).json({ items: jobs });
});

export const listJobs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req);
  const filter = {};
  if (req.user.role === 'transcriber') {
    filter.assignedTranscriber = req.user._id;
    filter.status = { $in: ['Assigned', 'In Progress', 'Draft Saved', 'Returned for Correction', 'Rejected'] };
  }
  if (req.user.role === 'reviewer') {
    filter.$or = [
      { reviewer: req.user._id },
      { status: { $in: reviewerReadableStatuses } }
    ];
  }
  ['project', 'language', 'assignedTl', 'assignedTranscriber', 'reviewer', 'priority'].forEach((key) => {
    if (req.query[key]) filter[key] = req.query[key];
  });
  if (req.query.status && req.user.role !== 'transcriber') filter.status = req.query.status;
  if (req.query.search) {
    const searchRegex = new RegExp(escapeRegex(req.query.search), 'i');
    const projectIds = await Project.find({
      $or: [
        { name: searchRegex },
        { client: searchRegex },
        { language: searchRegex }
      ]
    }).distinct('_id');
    const searchClause = {
      $or: [
        { originalFileName: searchRegex },
        { normalizedFileName: searchRegex },
        { project: { $in: projectIds } }
      ]
    };
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, searchClause];
      delete filter.$or;
    } else {
      Object.assign(filter, searchClause);
    }
  }
  if (req.query.from || req.query.to) filter.createdAt = {
    ...(req.query.from ? { $gte: new Date(req.query.from) } : {}),
    ...(req.query.to ? { $lte: new Date(req.query.to) } : {})
  };
  const [items, total] = await Promise.all([
    AudioJob.find(filter).populate('project assignedTl assignedTranscriber reviewer tlAssignedBy transcriberAssignedBy reviewerAssignedBy', 'name email loginId language role').sort(sortFromQuery(req)).skip(skip).limit(limit),
    AudioJob.countDocuments(filter)
  ]);
  res.json({ items, page, limit, total });
});

export const getJob = asyncHandler(async (req, res) => {
  const job = await AudioJob.findById(req.params.id).populate('project assignedTl assignedTranscriber reviewer tlAssignedBy transcriberAssignedBy reviewerAssignedBy', 'name email loginId language role');
  if (!job) throw new ApiError(404, 'Audio file not found');
  if (!(await canAccessJob(req.user, job))) throw new ApiError(403, 'You cannot access this audio file');
  res.json({ job });
});

export const playbackUrl = asyncHandler(async (req, res) => {
  const job = await AudioJob.findById(req.params.id);
  if (!job) throw new ApiError(404, 'Audio file not found');
  if (!(await canAccessJob(req.user, job))) throw new ApiError(403, 'You cannot play this audio file');
  const url = await getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: job.r2ObjectKey }), { expiresIn: 60 * 10 });
  await logActivity({ actor: req.user._id, action: 'audio_playback_url_created', entityType: 'AudioJob', entityId: job._id, req });
  res.json({ url, expiresIn: 600 });
});

export const streamAudio = asyncHandler(async (req, res) => {
  const job = await AudioJob.findById(req.params.id);
  if (!job) throw new ApiError(404, 'Audio file not found');
  if (!(await canAccessJob(req.user, job))) throw new ApiError(403, 'You cannot play this audio file');

  const range = req.headers.range;
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: job.r2ObjectKey,
    ...(range ? { Range: range } : {})
  });
  const object = await r2.send(command);

  res.status(range ? 206 : 200);
  res.setHeader('Content-Type', job.mimeType || object.ContentType || 'audio/wav');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, max-age=0, no-store');
  if (object.ContentLength) res.setHeader('Content-Length', String(object.ContentLength));
  if (object.ContentRange) res.setHeader('Content-Range', object.ContentRange);

  object.Body.on('error', (error) => {
    if (!res.headersSent) res.status(502).json({ message: error.message });
    else res.destroy(error);
  });
  object.Body.pipe(res);
});

export const assignJobsSchema = z.object({
  body: z.object({
    jobIds: z.array(z.string()).min(1),
    assignedTl: z.string().optional(),
    assignedTranscriber: z.string().optional(),
    reviewer: z.string().optional(),
    priority: z.enum(['Low', 'Normal', 'High', 'Urgent']).optional(),
    deadline: z.string().optional()
  })
});

export const assignJobs = asyncHandler(async (req, res) => {
  const now = new Date();
  const update = {
    ...(req.body.assignedTl ? { assignedTl: req.body.assignedTl, tlAssignedBy: req.user._id, tlAssignedAt: now } : {}),
    ...(req.body.assignedTranscriber ? { assignedTranscriber: req.body.assignedTranscriber, transcriberAssignedBy: req.user._id, transcriberAssignedAt: now, status: 'Assigned' } : {}),
    ...(req.body.reviewer ? { reviewer: req.body.reviewer, reviewerAssignedBy: req.user._id, reviewerAssignedAt: now } : {}),
    ...(req.body.priority ? { priority: req.body.priority } : {}),
    ...(req.body.deadline ? { deadline: new Date(req.body.deadline) } : {})
  };
  const result = await AudioJob.updateMany({ _id: { $in: req.body.jobIds }, status: { $ne: 'Approved' } }, update);
  const jobs = await AudioJob.find({ _id: { $in: req.body.jobIds } });
  await Promise.all(jobs.flatMap((job) => [
    req.body.assignedTl ? notifyTl(job) : null,
    req.body.assignedTranscriber ? notifyAssignee(job) : null,
    req.body.reviewer ? notifyReviewer(job) : null
  ].filter(Boolean)));
  await logActivity({ actor: req.user._id, action: 'audio_assigned', entityType: 'AudioJob', metadata: req.body, req });
  res.json({ modified: result.modifiedCount });
});

export const updateJob = asyncHandler(async (req, res) => {
  const allowed = ['language', 'priority', 'deadline', 'status', 'assignedTl', 'assignedTranscriber', 'reviewer', 'lastPlaybackPosition'];
  const payload = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (payload.deadline) payload.deadline = new Date(payload.deadline);
  if (req.user.role !== 'admin') {
    delete payload.language; delete payload.priority; delete payload.deadline; delete payload.assignedTl; delete payload.assignedTranscriber; delete payload.reviewer;
  }
  const job = await AudioJob.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
  if (!job) throw new ApiError(404, 'Audio file not found');
  if (!(await canAccessJob(req.user, job))) throw new ApiError(403, 'You cannot update this audio file');
  await logActivity({ actor: req.user._id, action: 'audio_updated', entityType: 'AudioJob', entityId: job._id, metadata: payload, req });
  res.json({ job });
});

export const archiveJob = asyncHandler(async (req, res) => {
  const job = await AudioJob.findByIdAndUpdate(req.params.id, { status: 'Archived', archivedAt: new Date() }, { new: true });
  if (!job) throw new ApiError(404, 'Audio file not found');
  await logActivity({ actor: req.user._id, action: 'audio_archived', entityType: 'AudioJob', entityId: job._id, req });
  res.json({ job });
});

export const deleteJob = asyncHandler(async (req, res) => {
  const job = await AudioJob.findById(req.params.id);
  if (!job) throw new ApiError(404, 'Audio file not found');
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: job.r2ObjectKey }));
  await Promise.all([
    TranscriptionSegment.deleteMany({ audioJob: job._id }),
    Review.deleteMany({ audioJob: job._id })
  ]);
  await job.deleteOne();
  await logActivity({ actor: req.user._id, action: 'audio_deleted', entityType: 'AudioJob', entityId: job._id, req });
  res.json({ message: 'Audio permanently deleted' });
});

async function notifyAssignee(job) {
  if (!job.assignedTranscriber) return;
  const user = await User.findById(job.assignedTranscriber);
  if (!user) return;
  await Notification.create({
    recipient: user._id,
    title: 'New audio assigned',
    message: `${job.originalFileName} is ready for transcription.`,
    type: 'assignment',
    link: `/transcriber/work/${job._id}`
  });
}

async function notifyTl(job) {
  if (job.assignedTl) {
    const tl = await User.findById(job.assignedTl);
    if (tl) {
      await Notification.create({
        recipient: tl._id,
        title: 'New transcriber queue file',
        message: `${job.originalFileName} is waiting in your transcriber queue.`,
        type: 'assignment',
        link: '/admin/review'
      });
    }
  }
}

async function notifyReviewer(job) {
  if (!job.reviewer) return;
  const user = await User.findById(job.reviewer);
  if (!user) return;
  await Notification.create({
    recipient: user._id,
    title: 'New review assigned',
    message: `${job.originalFileName} is ready for review.`,
    type: 'assignment',
    link: '/admin/review'
  });
}

async function notifyAssignees(job) {
  await notifyTl(job);
  await notifyAssignee(job);
  await notifyReviewer(job);
}
