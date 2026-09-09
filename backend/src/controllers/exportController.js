import { stringify } from 'csv-stringify/sync';
import { AudioJob } from '../models/AudioJob.js';
import { TranscriptionSegment } from '../models/TranscriptionSegment.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';

function stamp(seconds, vtt = false) {
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600).toString().padStart(2, '0');
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}${vtt ? '.' : ','}${ms}`;
}

async function load(jobId) {
  const job = await AudioJob.findById(jobId).populate('project assignedTranscriber');
  if (!job) throw new ApiError(404, 'Audio file not found');
  const segments = await TranscriptionSegment.find({ audioJob: job._id }).sort('segmentNumber').populate('tags');
  return { job, segments };
}

export const exportJob = asyncHandler(async (req, res) => {
  const { format } = req.params;
  const { job, segments } = await load(req.params.jobId);
  const rows = segments.map((s) => ({
    segment: s.segmentNumber,
    start: stamp(s.startTime, true),
    end: stamp(s.endTime, true),
    speaker: s.speakerLabel,
    gender: s.genderLabel,
    tags: s.tags.map((t) => t.name).join('|'),
    text: s.transcriptText,
    reviewerComment: s.reviewerComment
  }));
  const base = job.originalFileName.replace(/\.[^.]+$/, '');
  if (format === 'json') return res.attachment(`${base}.json`).json({ job, segments: rows });
  if (format === 'csv') return res.attachment(`${base}.csv`).type('text/csv').send(stringify(rows, { header: true }));
  if (format === 'txt') return res.attachment(`${base}.txt`).type('text/plain').send(rows.map((r) => `[${r.start} - ${r.end}] ${r.speaker}: ${r.text}`).join('\n'));
  if (format === 'srt') {
    const body = rows.map((r, i) => `${i + 1}\n${stamp(segments[i].startTime)} --> ${stamp(segments[i].endTime)}\n${r.text}\n`).join('\n');
    return res.attachment(`${base}.srt`).type('application/x-subrip').send(body);
  }
  if (format === 'vtt') {
    const body = `WEBVTT\n\n${rows.map((r, i) => `${i + 1}\n${stamp(segments[i].startTime, true)} --> ${stamp(segments[i].endTime, true)}\n${r.text}\n`).join('\n')}`;
    return res.attachment(`${base}.vtt`).type('text/vtt').send(body);
  }
  throw new ApiError(400, 'Unsupported export format');
});
