import { stringify } from 'csv-stringify/sync';
import { AudioJob } from '../models/AudioJob.js';
import { User } from '../models/User.js';
import { Project } from '../models/Project.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { getAppSettings } from './settingsController.js';

const LIVE_WORK_STATUSES = ['In Progress', 'Draft Saved'];

function dateMatch(req) {
  return req.query.from || req.query.to ? {
    createdAt: {
      ...(req.query.from ? { $gte: new Date(req.query.from) } : {}),
      ...(req.query.to ? { $lte: new Date(req.query.to) } : {})
    }
  } : {};
}

function reportMatch(req) {
  const base = dateMatch(req);
  if (req.user.role === 'reviewer') return { ...base, reviewer: req.user._id };
  if (req.user.role === 'tl') {
    return {
      ...base,
      $or: [
        { assignedTl: req.user._id },
        { transcriberAssignedBy: req.user._id },
        { reviewerAssignedBy: req.user._id }
      ]
    };
  }
  return base;
}

export const dashboard = asyncHandler(async (req, res) => {
  const base = reportMatch(req);
  const listPopulate = 'project assignedTranscriber reviewer';
  const listFields = 'originalFileName project language status assignedTranscriber reviewer submittedAt approvedAt updatedAt createdAt';
  const [projects, totalFiles, durationAgg, activeTranscribers, byStatus, submittedFiles, rejectedFiles] = await Promise.all([
    ['reviewer', 'tl'].includes(req.user.role) ? AudioJob.distinct('project', base).then((items) => items.length) : Project.countDocuments({ isActive: true }),
    AudioJob.countDocuments(base),
    AudioJob.aggregate([{ $match: base }, { $group: { _id: null, total: { $sum: '$duration' } } }]),
    req.user.role === 'tl'
      ? AudioJob.distinct('assignedTranscriber', { ...base, assignedTranscriber: { $exists: true } }).then((items) => items.filter(Boolean).length)
      : User.countDocuments({ role: 'transcriber', isActive: true }),
    AudioJob.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    AudioJob.find({ ...base, status: { $in: ['Submitted', 'Resubmitted', 'Under Review'] } })
      .select(listFields)
      .populate(listPopulate, 'name loginId email role')
      .sort('-submittedAt -updatedAt')
      .limit(25),
    AudioJob.find({ ...base, status: 'Rejected' })
      .select(listFields)
      .populate(listPopulate, 'name loginId email role')
      .sort('-updatedAt')
      .limit(25)
  ]);
  const statusCounts = Object.fromEntries(byStatus.map((row) => [row._id, row.count]));
  res.json({
    cards: {
      totalProjects: projects,
      totalAudioFiles: totalFiles,
      totalAudioDuration: durationAgg[0]?.total || 0,
      activeTranscribers,
      unassignedFiles: statusCounts.Unassigned || 0,
      assignedFiles: statusCounts.Assigned || 0,
      liveWorkFiles: LIVE_WORK_STATUSES.reduce((total, status) => total + (statusCounts[status] || 0), 0),
      inProgressFiles: statusCounts['In Progress'] || 0,
      submittedFiles: (statusCounts.Submitted || 0) + (statusCounts.Resubmitted || 0) + (statusCounts['Under Review'] || 0),
      approvedFiles: statusCounts.Approved || 0,
      returnedFiles: statusCounts['Returned for Correction'] || 0,
      rejectedFiles: statusCounts.Rejected || 0
    },
    lists: { submittedFiles, rejectedFiles }
  });
});

export const charts = asyncHandler(async (req, res) => {
  const base = reportMatch(req);
  const [dailyCompleted, projectProgress, productivity, reviewRate] = await Promise.all([
    AudioJob.aggregate([
      { $match: { ...base, status: 'Approved', approvedAt: { $exists: true } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$approvedAt' } }, duration: { $sum: '$duration' }, files: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    AudioJob.aggregate([
      { $match: base },
      { $group: { _id: { project: '$project', status: '$status' }, count: { $sum: 1 } } },
      { $lookup: { from: 'projects', localField: '_id.project', foreignField: '_id', as: 'project' } },
      { $project: { project: { $first: '$project.name' }, status: '$_id.status', count: 1 } }
    ]),
    AudioJob.aggregate([
      { $match: { ...base, assignedTranscriber: { $exists: true } } },
      { $group: { _id: '$assignedTranscriber', files: { $sum: 1 }, approvedDuration: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, '$duration', 0] } } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $project: { user: { $first: '$user.name' }, files: 1, approvedDuration: 1 } }
    ]),
    AudioJob.aggregate([
      { $match: base },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);
  res.json({ dailyCompleted, projectProgress, productivity, reviewRate });
});

export const downloadReport = asyncHandler(async (req, res) => {
  if (req.user.role === 'tl') {
    const settings = await getAppSettings();
    if (!settings.allowTlReportDownload) throw new ApiError(403, 'TL report download is disabled');
  }

  const jobs = await AudioJob.find(reportMatch(req))
    .populate('project assignedTl assignedTranscriber reviewer', 'name loginId email role')
    .sort('-createdAt');

  const rows = jobs.map((job) => ({
    fileName: job.originalFileName,
    project: job.project?.name || '',
    language: job.language || '',
    status: job.status || '',
    durationSeconds: job.duration || 0,
    assignedTl: job.assignedTl?.name || '',
    assignedTranscriber: job.assignedTranscriber?.name || '',
    reviewer: job.reviewer?.name || '',
    priority: job.priority || '',
    deadline: job.deadline ? job.deadline.toISOString() : '',
    createdAt: job.createdAt ? job.createdAt.toISOString() : '',
    updatedAt: job.updatedAt ? job.updatedAt.toISOString() : '',
    submittedAt: job.submittedAt ? job.submittedAt.toISOString() : '',
    approvedAt: job.approvedAt ? job.approvedAt.toISOString() : ''
  }));

  const stamp = new Date().toISOString().slice(0, 10);
  res
    .attachment(`trimurya-report-${stamp}.csv`)
    .type('text/csv')
    .send(stringify(rows, { header: true }));
});
