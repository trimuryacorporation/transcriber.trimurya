import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { ExternalLink, FastForward, Languages, Pause, Play, Rewind, Save, Send, Trash2, X } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatSeconds } from '../utils/time.js';

const emptySegment = (n, start = 0) => ({
  segmentNumber: n,
  startTime: start,
  endTime: start + 3,
  speakerLabel: 'Speaker 1',
  genderLabel: 'Unknown',
  transcriptText: '',
  tags: []
});
const activeRegionColor = 'rgba(34, 197, 94, 0.32)';
const inactiveRegionColor = 'rgba(15, 23, 42, 0.10)';
const draftRegionColor = 'rgba(34, 197, 94, 0.22)';
const inputLanguages = [
  ['auto', 'Auto detect'],
  ['en', 'English'],
  ['hi', 'Hindi'],
  ['bn', 'Bengali'],
  ['gu', 'Gujarati'],
  ['kn', 'Kannada'],
  ['ml', 'Malayalam'],
  ['mr', 'Marathi'],
  ['ne', 'Nepali'],
  ['or', 'Odia'],
  ['pa', 'Punjabi'],
  ['sa', 'Sanskrit'],
  ['ta', 'Tamil'],
  ['te', 'Telugu'],
  ['ur', 'Urdu'],
  ['ar', 'Arabic'],
  ['fa', 'Persian'],
  ['he', 'Hebrew'],
  ['zh', 'Chinese'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['fr', 'French'],
  ['de', 'German'],
  ['es', 'Spanish'],
  ['pt', 'Portuguese'],
  ['ru', 'Russian'],
  ['it', 'Italian'],
  ['tr', 'Turkish'],
  ['th', 'Thai'],
  ['vi', 'Vietnamese'],
  ['id', 'Indonesian']
];
const rtlLanguages = new Set(['ar', 'fa', 'he', 'ur']);
const transcriberReadOnlyStatuses = new Set(['Submitted', 'Resubmitted', 'Under Review', 'Approved']);

export function TranscriptionWorkspace() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const waveRef = useRef(null);
  const regionsRef = useRef(null);
  const draftRegionRef = useRef(null);
  const loopRangeRef = useRef(null);
  const activeLoopIndexRef = useRef(null);
  const segmentsRef = useRef([]);
  const hostRef = useRef(null);
  const transcriptRef = useRef(null);
  const dirtyRef = useRef(false);
  const [job, setJob] = useState(null);
  const [segments, setSegments] = useState([]);
  const [tags, setTags] = useState([]);
  const [active, setActive] = useState(0);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(0.9);
  const [status, setStatus] = useState('Loading');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [showReviewerComments, setShowReviewerComments] = useState(false);
  const [selectedRange, setSelectedRange] = useState(null);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [inputLanguage, setInputLanguage] = useState('auto');
  const [readOnly, setReadOnly] = useState(false);
  const activeSegment = segments[active] || emptySegment(1);
  const canEditReviewerComments = ['reviewer', 'admin', 'tl'].includes(user?.role);
  const canEditTranscript = ['admin', 'tl', 'reviewer'].includes(user?.role) || (user?.role === 'transcriber' && !readOnly);
  const showTranscriberActions = user?.role !== 'reviewer';
  const wordCount = useMemo(() => segments.reduce((n, s) => n + s.transcriptText.trim().split(/\s+/).filter(Boolean).length, 0), [segments]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const jobRequest = api.get(`/audio/${jobId}`).then((res) => ({ data: { job: res.data.job } }));
        const [{ data: loaded }, { data: segmentData }] = await Promise.all([
          jobRequest,
          api.get(`/transcriptions/${jobId}/segments`)
        ]);
        if (!alive) return;
        const loadedReadOnly = Boolean(loaded.readOnly) || (user?.role === 'transcriber' && transcriberReadOnlyStatuses.has(loaded.job.status));
        const canEditLoadedTranscript = ['admin', 'tl', 'reviewer'].includes(user?.role) || (user?.role === 'transcriber' && !loadedReadOnly);
        setJob(loaded.job);
        setReadOnly(loadedReadOnly);
        const projectData = await api.get(`/projects/${loaded.job.project?._id || loaded.job.project}`);
        const initialSegments = segmentData.items.length ? segmentData.items : [emptySegment(1, loaded.job.lastPlaybackPosition || 0)];
        setTags(projectData.data.tags || []);
        setJob({ ...loaded.job, project: projectData.data.project });
        setSegments(initialSegments);
        const ws = WaveSurfer.create({
          container: hostRef.current,
          waveColor: '#cbd5e1',
          progressColor: '#12325f',
          cursorColor: '#f4b400',
          height: 96,
          url: `${api.defaults.baseURL}/audio/${jobId}/stream`,
          fetchParams: { credentials: 'include' }
        });
        waveRef.current = ws;
        const regions = ws.registerPlugin(RegionsPlugin.create());
        regionsRef.current = regions;
        if (canEditLoadedTranscript) regions.enableDragSelection({ color: draftRegionColor, drag: true, resize: true, minLength: 0.05 }, 5);
        regions.on('region-created', (region) => {
          if (!canEditLoadedTranscript) return;
          if (region.id.startsWith('segment-')) return;
          if (draftRegionRef.current && draftRegionRef.current !== region) draftRegionRef.current.remove();
          draftRegionRef.current = region;
          setSelectedRange(normalizeRange(region.start, region.end));
          dirtyRef.current = true;
          setStatus('Range selected');
        });
        regions.on('region-updated', (region) => {
          if (!canEditLoadedTranscript) return;
          if (region.id.startsWith('segment-')) {
            const segmentNumber = Number(region.id.replace('segment-', ''));
            if (!segmentNumber) return;
            const range = normalizeRange(region.start, region.end);
            dirtyRef.current = true;
            setActive(segmentNumber - 1);
            setSegments((current) => current.map((segment, index) => index === segmentNumber - 1
              ? { ...segment, startTime: range.start, endTime: range.end }
              : segment));
            loopRangeRef.current = range;
            setStatus('Segment time updated');
            return;
          }
          draftRegionRef.current = region;
          setSelectedRange(normalizeRange(region.start, region.end));
          dirtyRef.current = true;
          setStatus('Range selected');
        });
        regions.on('region-clicked', (region, e) => {
          e.stopPropagation();
          if (region.id.startsWith('segment-')) {
            const segmentNumber = Number(region.id.replace('segment-', ''));
            const index = segmentNumber - 1;
            if (index >= 0) {
              playSegmentLoop(index);
            }
          }
        });
        ws.on('ready', () => { setDuration(ws.getDuration()); ws.setTime(loaded.job.lastPlaybackPosition || 0); setStatus(user?.role === 'reviewer' ? 'Review mode' : 'Ready'); });
        ws.on('timeupdate', (t) => {
          setTime(t);
          const loopRange = loopRangeRef.current;
          if (loopRange && t >= loopRange.end) {
            ws.setTime(loopRange.start);
            ws.play();
            return;
          }
          if (loopRange && activeLoopIndexRef.current !== null) {
            const loopSegment = segmentsRef.current[activeLoopIndexRef.current];
            if (loopSegment && t >= loopSegment.startTime && t <= loopSegment.endTime) {
              setActive(activeLoopIndexRef.current);
              return;
            }
          }
          setActive((current) => segmentIndexAt(segmentsRef.current, t, current));
        });
        ws.on('play', () => setPlaying(true));
        ws.on('pause', () => setPlaying(false));
        ws.on('error', (error) => setStatus(`Audio load failed: ${error?.message || error}`));
      } catch (err) {
        setStatus(err.response?.data?.message || err.message);
        setReadOnly(true);
      }
    })();
    return () => {
      alive = false;
      regionsRef.current = null;
      draftRegionRef.current = null;
      loopRangeRef.current = null;
      activeLoopIndexRef.current = null;
      waveRef.current?.destroy();
    };
  }, [jobId, user?.role]);

  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions || !duration) return;
    regions.clearRegions();
    draftRegionRef.current = null;
    setSelectedRange(null);
    segments.forEach((segment, index) => {
      if (segment.endTime <= segment.startTime) return;
      regions.addRegion({
        id: `segment-${index + 1}`,
        start: segment.startTime,
        end: segment.endTime,
        color: index === active ? activeRegionColor : inactiveRegionColor,
        drag: index === active && canEditTranscript,
        resize: index === active && canEditTranscript
      });
    });
  }, [segments, active, duration, canEditTranscript]);

  useEffect(() => {
    waveRef.current?.setPlaybackRate(speed);
    waveRef.current?.setVolume(volume);
  }, [speed, volume]);

  useEffect(() => {
    const timer = setInterval(() => { if (dirtyRef.current) saveDraft('Autosaved'); }, 5000);
    return () => clearInterval(timer);
  }, [segments, time]);

  useEffect(() => {
    const before = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      const typing = tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT';
      if (e.key === 'Escape' && showTagMenu) { e.preventDefault(); setShowTagMenu(false); return; }
      if (typing && !(e.ctrlKey || e.altKey || e.shiftKey)) return;
      if (e.code === 'Space' && !typing) { e.preventDefault(); toggle(); }
      if (e.ctrlKey && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addSegment(); }
      if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); saveDraft('Saved'); }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); seek(time - 5); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); seek(time + 5); }
      if (e.ctrlKey && e.key.toLowerCase() === 'm') { e.preventDefault(); updateActive({ transcriptText: `${activeSegment.transcriptText} [${formatSeconds(time)}]` }); }
      if (e.ctrlKey && e.shiftKey && e.key === 'Enter') { e.preventDefault(); submit(); }
      if (e.shiftKey && (e.key === '$' || e.key === '4')) { e.preventDefault(); transcriptRef.current?.focus(); setShowTagMenu(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [time, activeSegment, segments, showTagMenu]);

  function toggle() { waveRef.current?.playPause(); }
  function seek(value) { waveRef.current?.setTime(Math.max(0, Math.min(duration, value))); }
  function markDirty(next) {
    if (!canEditTranscript) return;
    dirtyRef.current = true;
    setSegments(next);
    setStatus('Unsaved changes');
  }
  function updateActive(patch) { markDirty(segments.map((s, i) => i === active ? { ...s, ...patch } : s)); }
  function updateSegment(index, patch) { markDirty(segments.map((s, i) => i === index ? { ...s, ...patch } : s)); }
  function updateReviewerComment(value) {
    if (!canEditReviewerComments) return;
    dirtyRef.current = true;
    setSegments(segments.map((s, i) => i === active ? { ...s, reviewerComment: value } : s));
    setStatus('Reviewer comment unsaved');
  }
  function insertTag(tag) {
    const label = tag.name || tag.label || tag.value || 'Tag';
    const marker = `[${label}]`;
    const text = activeSegment.transcriptText || '';
    const start = transcriptRef.current?.selectionStart ?? text.length;
    const end = transcriptRef.current?.selectionEnd ?? start;
    const nextText = `${text.slice(0, start)}${marker}${text.slice(end)}`;
    updateActive({ transcriptText: nextText });
    setShowTagMenu(false);
    window.setTimeout(() => {
      transcriptRef.current?.focus();
      transcriptRef.current?.setSelectionRange(start + marker.length, start + marker.length);
    }, 0);
  }
  function playSegmentLoop(index) {
    const segment = segmentsRef.current[index];
    if (!segment || segment.endTime <= segment.startTime) return;
    loopRangeRef.current = normalizeRange(segment.startTime, segment.endTime);
    activeLoopIndexRef.current = index;
    setActive(index);
    setStatus(`Looping segment #${index + 1}`);
    waveRef.current?.setTime(segment.startTime);
    waveRef.current?.play();
  }
  function addSegment() {
    if (!canEditTranscript) return;
    const range = selectedRange || { start: time, end: time + 3 };
    const next = [...segments, emptySegment(segments.length + 1, range.start)]
      .map((segment, index, all) => index === all.length - 1 ? { ...segment, startTime: range.start, endTime: range.end } : segment)
      .sort((a, b) => a.startTime - b.startTime)
      .map((s, i) => ({ ...s, segmentNumber: i + 1 }));
    markDirty(next);
    setActive(next.findIndex((s) => s.startTime === range.start && s.endTime === range.end));
    loopRangeRef.current = null;
    activeLoopIndexRef.current = null;
    draftRegionRef.current?.remove();
    draftRegionRef.current = null;
    setSelectedRange(null);
  }
  async function deleteSegment(index) {
    if (!canEditTranscript) return;
    const segment = segments[index];
    if (!segment || segments.length <= 1) return;
    if (segment._id) await api.delete(`/transcriptions/${jobId}/segments/${segment._id}`);
    const next = segments.filter((_, i) => i !== index).map((s, i) => ({ ...s, segmentNumber: i + 1 }));
    dirtyRef.current = true;
    setSegments(next);
    setActive(Math.max(0, Math.min(index, next.length - 1)));
    loopRangeRef.current = null;
    activeLoopIndexRef.current = null;
    setStatus('Segment deleted');
  }
  function cleanSegment(segment, index) {
    return {
      _id: segment._id,
      segmentNumber: index + 1,
      startTime: Number(segment.startTime),
      endTime: Number(segment.endTime),
      speakerLabel: segment.speakerLabel || 'Speaker 1',
      genderLabel: segment.genderLabel || 'Unknown',
      transcriptText: segment.transcriptText || '',
      tags: (segment.tags || []).map((tag) => tag?._id || tag).filter(Boolean),
      reviewerComment: segment.reviewerComment || ''
    };
  }
  function segmentsForSave() {
    if (!selectedRange || !canEditTranscript) return { items: segments, activeIndex: active };
    const range = selectedRange;
    const current = segments[active];
    const currentIsEmpty = current
      && !current.transcriptText?.trim()
      && !current.reviewerComment?.trim()
      && !(current.tags || []).length;
    const targetMarker = `selected-${Date.now()}`;
    const items = currentIsEmpty
      ? segments.map((segment, index) => index === active ? { ...segment, startTime: range.start, endTime: range.end, saveMarker: targetMarker } : segment)
      : [...segments, { ...emptySegment(segments.length + 1, range.start), startTime: range.start, endTime: range.end, saveMarker: targetMarker }];
    const sorted = items
      .sort((a, b) => a.startTime - b.startTime)
      .map((segment, index) => ({ ...segment, segmentNumber: index + 1 }));
    const activeIndex = Math.max(0, sorted.findIndex((segment) => segment.saveMarker === targetMarker));
    return { items: sorted.map(({ saveMarker, ...segment }) => segment), activeIndex };
  }
  async function saveDraft(done = 'Saved') {
    if (!canEditTranscript && !canEditReviewerComments) return;
    try {
      setStatus('Saving...');
      const prepared = segmentsForSave();
      const res = await api.put(`/transcriptions/${jobId}/segments`, { segments: prepared.items.map(cleanSegment), lastPlaybackPosition: time });
      const fresh = await api.get(`/transcriptions/${jobId}/segments`);
      dirtyRef.current = false;
      const savedItems = (fresh.data.items || res.data.items || []).sort((a, b) => a.segmentNumber - b.segmentNumber);
      setSegments(savedItems);
      setActive(Math.min(prepared.activeIndex, Math.max(0, savedItems.length - 1)));
      setJob((current) => ({ ...res.data.job, project: current?.project || res.data.job.project }));
      loopRangeRef.current = null;
      activeLoopIndexRef.current = null;
      draftRegionRef.current?.remove();
      draftRegionRef.current = null;
      setSelectedRange(null);
      setStatus(done);
    } catch (err) {
      setStatus(err.response?.data?.message || err.message);
      throw err;
    }
  }
  async function submit() {
    if (!canEditTranscript) return;
    if (dirtyRef.current) await saveDraft('Saved');
    await api.post(`/transcriptions/${jobId}/submit`);
    navigate('/transcriber/work');
  }
  async function reviewDecision(decision) {
    if (user?.role !== 'reviewer') return;
    try {
      if (dirtyRef.current) await saveDraft('Reviewer comment saved');
      await api.post(`/reviews/${jobId}/complete`, {
        decision,
        comments: '',
        segmentComments: segments
          .filter((segment) => segment._id && segment.reviewerComment)
          .map((segment) => ({ segment: segment._id, comment: segment.reviewerComment }))
      });
      navigate('/admin/review');
    } catch (err) {
      setStatus(err.response?.data?.message || err.message);
    }
  }

  const project = job?.project || {};
  const speakers = project.speakers || [{ label: 'Speaker 1', value: 'Speaker 1' }, { label: 'Speaker 2', value: 'Speaker 2' }];
  const genders = project.genders || [{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Unknown', value: 'Unknown' }];
  const quickSpeakers = speakers.slice(0, 2);
  const quickGenders = genders.filter((g) => ['Male', 'Female'].includes(g.value)).slice(0, 2);
  const textLanguage = inputLanguage === 'auto' ? undefined : inputLanguage;
  const textDirection = inputLanguage === 'auto' ? 'auto' : rtlLanguages.has(inputLanguage) ? 'rtl' : 'ltr';
  const visibleSegments = segments.map((segment, index) => ({ segment, index }));

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold">{job?.originalFileName || 'Transcription Workspace'}</h2>
        <p className="text-sm text-slate-500">{formatSeconds(time)} / {formatSeconds(duration)} - {wordCount} words - {segments.length} segments - {selectedRange ? `Selected ${formatSeconds(selectedRange.start)} - ${formatSeconds(selectedRange.end)}` : status}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-muted" onClick={() => { setShowGuidelines(false); setShowShortcuts(true); }}>Shortcuts</button>
        <button className="btn-muted" onClick={() => { setShowShortcuts(false); setShowReviewerComments(false); setShowGuidelines(true); }}>Guidelines</button>
        <button className="btn-muted" onClick={() => { setShowShortcuts(false); setShowGuidelines(false); setShowReviewerComments(true); }}>Reviewer Comments</button>
        {user?.role === 'reviewer' && <button className="btn-muted" disabled={!canEditTranscript} onClick={() => saveDraft('Saved')}><Save size={16} /> Save Changes</button>}
        {user?.role === 'reviewer' && <button className="btn-primary" onClick={() => reviewDecision('Approved')}><Send size={16} /> Send to Admin</button>}
        {user?.role === 'reviewer' && <button className="btn-accent" onClick={() => reviewDecision('Returned for Correction')}><Send size={16} /> Send to Recorrect</button>}
        {user?.role === 'reviewer' && <button className="btn-muted text-red-700" onClick={() => reviewDecision('Rejected')}><Send size={16} /> Send Rejected</button>}
        {showTranscriberActions && <button className="btn-muted" disabled={!canEditTranscript} onClick={() => saveDraft('Saved')}><Save size={16} /> Save Draft</button>}
        {showTranscriberActions && <button className="btn-accent" disabled={!canEditTranscript} onClick={submit}><Send size={16} /> Submit for Review</button>}
      </div>
    </div>
    {readOnly && user?.role === 'transcriber' && <p className="rounded-md border border-purple-200 bg-purple-50 p-3 text-sm font-medium text-purple-900">This file is submitted for review. Transcriber editing will be available again only if the reviewer returns correction or rejects it.</p>}
    {user?.role === 'reviewer' && <p className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm font-medium text-cyan-900">Review mode: audio and transcript are available. Add segment comments here, then send the final decision from this workspace.</p>}

    {showShortcuts && <Modal title="Shortcut Keys" onClose={() => setShowShortcuts(false)}>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        {[
          ['Space', 'Play / Pause'],
          ['Ctrl + Enter', 'Add segment'],
          ['Ctrl + S', 'Save draft'],
          ['Alt + Left', 'Skip back 5s'],
          ['Alt + Right', 'Skip forward 5s'],
          ['Ctrl + M', 'Insert timestamp'],
          ['Shift + $', 'Open tag menu']
        ].map(([key, label]) => <div key={key} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-slate-600">{label}</span>
          <kbd className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-sm">{key}</kbd>
        </div>)}
      </div>
    </Modal>}

    {showGuidelines && <Modal title="Guidelines" onClose={() => setShowGuidelines(false)}>
      <p className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{project.guidelines || 'No guidelines supplied.'}</p>
    </Modal>}

    {showReviewerComments && <Modal title="Reviewer Comments" onClose={() => setShowReviewerComments(false)}>
      {canEditReviewerComments ? <div className="space-y-3">
        {activeSegment.reviewerComment && <ReviewerCommentMeta segment={activeSegment} />}
        <textarea
          className="min-h-32"
          placeholder="Add reviewer comment for this segment"
          value={activeSegment.reviewerComment || ''}
          onChange={(e) => updateReviewerComment(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button className="btn-muted" onClick={() => setShowReviewerComments(false)}>Close</button>
          <button className="btn-primary" onClick={async () => { await saveDraft('Reviewer comment saved'); setShowReviewerComments(false); }}><Save size={16} /> Save Comment</button>
        </div>
      </div> : <div className="space-y-3">
        {activeSegment.reviewerComment && <ReviewerCommentMeta segment={activeSegment} />}
        <p className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{activeSegment.reviewerComment || 'No comments on this segment.'}</p>
      </div>}
    </Modal>}

    <section className="panel p-4">
      <div ref={hostRef} className="mb-4" />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={toggle}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
        <button className="btn-muted" onClick={() => seek(time - 5)}><Rewind size={16} /> 5s</button>
        <button className="btn-muted" onClick={() => seek(time + 5)}><FastForward size={16} /> 5s</button>
        <select className="w-28" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => <option key={s} value={s}>{s}x</option>)}</select>
        <input className="w-40" type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
      </div>
    </section>

    <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
      <aside className="panel max-h-[68vh] overflow-auto p-3">
        {visibleSegments.map(({ segment: s, index: i }) => <div key={s._id || s.segmentNumber} className={`mb-2 rounded-md border p-3 ${i === active ? 'border-primary bg-blue-50' : 'hover:bg-slate-50'}`}>
          <button onClick={() => playSegmentLoop(i)} className="w-full text-left">
            <p className="text-xs text-slate-500">#{s.segmentNumber} {formatSeconds(s.startTime)} - {formatSeconds(s.endTime)}</p>
            <p className="truncate font-medium">{s.transcriptText || 'Empty segment'}</p>
          </button>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {quickSpeakers.map((speaker) => <button key={speaker.value} disabled={!canEditTranscript} className={`rounded border px-2 py-1 text-xs font-semibold disabled:opacity-50 ${s.speakerLabel === speaker.value ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white text-slate-700'}`} onClick={() => updateSegment(i, { speakerLabel: speaker.value })}>{speaker.label}</button>)}
            {quickGenders.map((gender) => <button key={gender.value} disabled={!canEditTranscript} className={`rounded border px-2 py-1 text-xs font-semibold disabled:opacity-50 ${s.genderLabel === gender.value ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white text-slate-700'}`} onClick={() => updateSegment(i, { genderLabel: gender.value })}>{gender.label}</button>)}
            <button className="ml-auto rounded border border-red-200 bg-white px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50" title="Delete segment" disabled={segments.length <= 1 || !canEditTranscript} onClick={() => deleteSegment(i)}><Trash2 size={14} /></button>
          </div>
        </div>)}
        <button className="btn-muted w-full" disabled={!canEditTranscript} onClick={addSegment}>{selectedRange ? 'Add Selected Segment' : 'Add Segment'}</button>
      </aside>

      <section className="panel space-y-3 p-4">
        <div className="relative">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label>Transcript text</label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1">
                <Languages size={16} className="text-slate-500" />
                <select className="w-44 border-0 bg-transparent p-1 focus:ring-0" value={inputLanguage} onChange={(e) => setInputLanguage(e.target.value)}>{inputLanguages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </div>
              <button className="btn-muted py-2" type="button" onClick={() => window.open('https://www.google.com/inputtools/try/', '_blank', 'noopener,noreferrer')}><ExternalLink size={15} /> Google Input Tools</button>
            </div>
          </div>
          <textarea
            ref={transcriptRef}
            className="min-h-72 text-base leading-7"
            dir={textDirection}
            lang={textLanguage}
            spellCheck={false}
            readOnly={!canEditTranscript}
            value={activeSegment.transcriptText}
            onChange={(e) => updateActive({ transcriptText: e.target.value })}
            onFocus={() => setShowTagMenu(false)}
          />
          {showTagMenu && <div className="absolute left-0 top-8 z-20 w-full max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <p className="text-sm font-semibold text-slate-900">Choose tag</p>
              <button className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Close tags" onMouseDown={(e) => e.preventDefault()} onClick={() => setShowTagMenu(false)}><X size={15} /></button>
            </div>
            <div className="max-h-56 overflow-auto p-2">
              {tags.length ? tags.map((tag) => <button key={tag._id || tag.value || tag.name} className="mb-1 w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-primary" onMouseDown={(e) => e.preventDefault()} onClick={() => insertTag(tag)}>{tag.name || tag.label || tag.value}</button>) : <p className="px-3 py-2 text-sm text-slate-500">No tags available.</p>}
            </div>
          </div>}
        </div>
      </section>
    </div>
  </div>;
}

function segmentIndexAt(segments, time, fallback) {
  const current = segments[fallback];
  if (current && time >= current.startTime && time <= current.endTime) return fallback;
  const index = segments.findIndex((s) => time >= s.startTime && time <= s.endTime);
  return index >= 0 ? index : fallback;
}

function normalizeRange(start, end) {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  return { start: Number(from.toFixed(3)), end: Number(Math.max(to, from + 0.05).toFixed(3)) };
}

function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(<div
    className="fixed inset-0 flex items-center justify-center bg-slate-950/50 p-4"
    style={{ zIndex: 80 }}
    onMouseDown={onClose}
  >
    <section
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      style={{ width: 'min(680px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 96px)' }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <button className="grid h-9 w-9 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Close" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="overflow-auto p-5" style={{ maxHeight: 'calc(100vh - 170px)' }}>{children}</div>
    </section>
  </div>, document.body);
}

function ReviewerCommentMeta({ segment }) {
  const author = segment.reviewerCommentBy;
  const name = author?.name || 'Reviewer';
  const login = author?.loginId ? ` (${author.loginId})` : '';
  const time = segment.reviewerCommentAt ? new Date(segment.reviewerCommentAt).toLocaleString() : '';
  return <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
    Comment by {name}{login}{time ? ` - ${time}` : ''}
  </p>;
}
