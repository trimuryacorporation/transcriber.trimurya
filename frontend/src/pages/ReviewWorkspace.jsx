import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ClipboardCheck, Clock3, ShieldCheck, UserCheck } from 'lucide-react';
import { api } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const reviewStatuses = ['Submitted', 'Resubmitted', 'Under Review', 'Approved', 'Returned for Correction', 'Rejected'];
const reviewerSentStatuses = ['Approved', 'Returned for Correction', 'Rejected'];

export function ReviewWorkspace({ focus = 'review' }) {
  const { user } = useAuth();
  const location = useLocation();
  const canManageReviewPool = ['admin', 'tl'].includes(user?.role);
  const isTranscriberQueuePage = focus === 'transcriber';
  const search = useMemo(() => new URLSearchParams(location.search).get('search') || '', [location.search]);
  const [jobs, setJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [transcribers, setTranscribers] = useState([]);
  const [active, setActive] = useState(null);
  const [filters, setFilters] = useState({ project: '', language: '' });
  const [selectedTranscriberQueue, setSelectedTranscriberQueue] = useState([]);
  const [bulkTranscriber, setBulkTranscriber] = useState('');
  const [selectedPool, setSelectedPool] = useState([]);
  const [bulkReviewer, setBulkReviewer] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const transcriberQueue = useMemo(() => jobs.filter((job) => {
    const assignedTl = job.assignedTl?._id || job.assignedTl;
    const isCurrentTlJob = String(assignedTl || '') === String(user?._id || '');
    return user?.role === 'tl' && isCurrentTlJob && !job.assignedTranscriber && job.status !== 'Archived';
  }), [jobs, user]);
  const filteredTranscriberQueue = useMemo(() => transcriberQueue.filter((job) => {
    const matchesProject = !filters.project || String(job.project?._id || job.project) === filters.project;
    const matchesLanguage = !filters.language || job.language?.toLowerCase().includes(filters.language.toLowerCase());
    return matchesProject && matchesLanguage;
  }), [transcriberQueue, filters]);
  const tlPool = useMemo(() => jobs.filter((job) => ['Submitted', 'Resubmitted'].includes(job.status) && !job.reviewer), [jobs]);
  const filteredPool = useMemo(() => tlPool.filter((job) => {
    const matchesProject = !filters.project || String(job.project?._id || job.project) === filters.project;
    const matchesLanguage = !filters.language || job.language?.toLowerCase().includes(filters.language.toLowerCase());
    return matchesProject && matchesLanguage;
  }), [tlPool, filters]);
  const languages = useMemo(() => {
    const sourceJobs = isTranscriberQueuePage ? transcriberQueue : tlPool;
    const scopedJobs = filters.project
      ? sourceJobs.filter((job) => String(job.project?._id || job.project) === filters.project)
      : sourceJobs;
    return [...new Set(scopedJobs.map((job) => job.language).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [isTranscriberQueuePage, tlPool, transcriberQueue, filters.project]);
  const eligibleReviewers = useMemo(() => reviewers.filter((reviewer) => {
    if (!filters.language) return true;
    if (!reviewer.languages?.length) return true;
    return reviewer.languages.some((language) => language.toLowerCase() === filters.language.toLowerCase());
  }), [reviewers, filters.language]);
  const eligibleTranscribers = useMemo(() => transcribers.filter((transcriber) => {
    if (!filters.language) return true;
    if (!transcriber.languages?.length) return true;
    return transcriber.languages.some((language) => language.toLowerCase() === filters.language.toLowerCase());
  }), [transcribers, filters.language]);
  const allTranscriberQueueSelected = filteredTranscriberQueue.length > 0 && filteredTranscriberQueue.every((job) => selectedTranscriberQueue.includes(job._id));
  const allPoolSelected = filteredPool.length > 0 && filteredPool.every((job) => selectedPool.includes(job._id));
  const managedByCurrentTl = (job) => user?.role !== 'tl' || String(job.reviewerAssignedBy?._id || job.reviewerAssignedBy || '') === String(user?._id);
  const reviewerWork = useMemo(() => jobs.filter((job) => ['Submitted', 'Resubmitted', 'Under Review'].includes(job.status) && job.reviewer && managedByCurrentTl(job)), [jobs, user]);
  const reviewerSent = useMemo(() => jobs.filter((job) => reviewerSentStatuses.includes(job.status) && managedByCurrentTl(job)), [jobs, user]);
  const visibleReviewerJobs = jobs.filter((job) => ['Submitted', 'Resubmitted', 'Under Review'].includes(job.status));
  const reviewerCount = new Set(reviewerWork.map((job) => job.reviewer?._id || job.reviewer).filter(Boolean)).size;
  const transcriberCount = new Set([...reviewerWork, ...reviewerSent].map((job) => job.assignedTranscriber?._id || job.assignedTranscriber).filter(Boolean)).size;

  async function load({ silent = false } = {}) {
    if (!silent) setError('');
    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      const requests = isTranscriberQueuePage ? [] : reviewStatuses.map((status) => api.get(`/audio?status=${encodeURIComponent(status)}&limit=100${searchParam}`));
      const transcriberQueueRequest = user?.role === 'tl' && isTranscriberQueuePage
        ? api.get(`/audio?assignedTl=${user._id}&limit=100${searchParam}`)
        : Promise.resolve({ data: { items: [] } });
      const userRequest = canManageReviewPool ? api.get('/users?limit=100') : Promise.resolve({ data: { items: [] } });
      const projectRequest = canManageReviewPool ? api.get('/projects?limit=100') : Promise.resolve({ data: { items: [] } });
      const [userRes, projectRes, transcriberQueueRes, ...jobResponses] = await Promise.all([userRequest, projectRequest, transcriberQueueRequest, ...requests]);
      const merged = jobResponses.flatMap((res) => res.data.items || []);
      const uniqueJobs = [...new Map([...merged, ...(transcriberQueueRes.data.items || [])].map((job) => [job._id, job])).values()];
      setJobs(uniqueJobs);
      setProjects(projectRes.data.items || []);
      setReviewers((userRes.data.items || []).filter((item) => item.role === 'reviewer'));
      setTranscribers((userRes.data.items || []).filter((item) => item.role === 'transcriber'));
      setSelectedTranscriberQueue((current) => current.filter((id) => uniqueJobs.some((job) => job._id === id && !job.assignedTranscriber)));
      setSelectedPool((current) => current.filter((id) => uniqueJobs.some((job) => job._id === id && !job.reviewer)));
      setActive((current) => current ? uniqueJobs.find((job) => job._id === current._id) || current : current);
      setLastUpdated(new Date());
    } catch (err) {
      if (!silent) setError(err.response?.data?.message || err.message);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(() => load({ silent: true }), 8000);
    return () => clearInterval(timer);
  }, [canManageReviewPool, isTranscriberQueuePage, user?._id, search]);

  async function open(job) {
    setError('');
    setMessage('');
    try {
      const started = !canManageReviewPool && job.status !== 'Under Review' ? await api.post(`/reviews/${job._id}/start`) : null;
      setActive(started?.data?.job ? { ...job, ...started.data.job } : job);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  async function assignReviewer() {
    if (!bulkReviewer) {
      setError('Choose a reviewer first.');
      return;
    }
    if (!selectedPool.length) {
      setError('Select at least one file from TL Pool.');
      return;
    }
    setError('');
    setMessage('');
    try {
      const assignedReviewer = reviewers.find((reviewer) => reviewer._id === bulkReviewer);
      const reviewerLabel = assignedReviewer ? `${assignedReviewer.name} (${assignedReviewer.loginId})` : 'reviewer';
      const res = await api.post('/audio/assign', { jobIds: selectedPool, reviewer: bulkReviewer });
      setMessage(`${res.data.modified || selectedPool.length} file(s) assigned to ${reviewerLabel}.`);
      setSelectedPool([]);
      setBulkReviewer('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  async function assignTranscriber() {
    if (!bulkTranscriber) {
      setError('Choose a transcriber first.');
      return;
    }
    if (!selectedTranscriberQueue.length) {
      setError('Select at least one file from Transcriber Queue.');
      return;
    }
    setError('');
    setMessage('');
    try {
      const assignedTranscriber = transcribers.find((transcriber) => transcriber._id === bulkTranscriber);
      const transcriberLabel = assignedTranscriber ? userLabel(assignedTranscriber) : 'transcriber';
      const res = await api.post('/audio/assign', { jobIds: selectedTranscriberQueue, assignedTranscriber: bulkTranscriber });
      setMessage(`${res.data.modified || selectedTranscriberQueue.length} file(s) assigned to ${transcriberLabel}.`);
      setSelectedTranscriberQueue([]);
      setBulkTranscriber('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  function toggleTranscriberQueueSelection(id, checked) {
    setSelectedTranscriberQueue((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  }

  function toggleAllTranscriberQueue(checked) {
    const visibleIds = filteredTranscriberQueue.map((job) => job._id);
    setSelectedTranscriberQueue((current) => checked
      ? [...new Set([...current, ...visibleIds])]
      : current.filter((id) => !visibleIds.includes(id)));
  }

  function togglePoolSelection(id, checked) {
    setSelectedPool((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  }

  function toggleAllPool(checked) {
    const visibleIds = filteredPool.map((job) => job._id);
    setSelectedPool((current) => checked
      ? [...new Set([...current, ...visibleIds])]
      : current.filter((id) => !visibleIds.includes(id)));
  }

  return <div className="space-y-5">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{isTranscriberQueuePage ? 'Transcriber Allocation' : 'Review Operations'}</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">{isTranscriberQueuePage ? 'Transcriber Queue Control' : 'Review Queue Control'}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {isTranscriberQueuePage
              ? 'Assign TL-managed audio files to available transcribers with project and language context.'
              : 'Route submitted transcription work to qualified reviewers and monitor review ownership across active queues.'}
          </p>
        </div>
        {lastUpdated && <div className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"><Clock3 size={16} /> Updated {lastUpdated.toLocaleTimeString()}</div>}
      </div>
    </section>

    {canManageReviewPool && <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-primary"><ClipboardCheck size={19} /></div>
        <div>
          <h3 className="font-bold text-slate-950">{isTranscriberQueuePage ? 'Transcriber Assignment Criteria' : 'Reviewer Assignment Criteria'}</h3>
          <p className="mt-1 text-sm text-slate-500">Filter by project and language before assigning selected queue items to the appropriate operational owner.</p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <div>
          <label>Project scope</label>
          <select value={filters.project} onChange={(e) => { setFilters({ project: e.target.value, language: '' }); setSelectedPool([]); setSelectedTranscriberQueue([]); }}>
            <option value="">Select project</option>
            {projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
          </select>
        </div>
        <div>
          <label>Language scope</label>
          <input
            list="review-languages"
            placeholder={filters.project ? 'Search language' : 'Select project first'}
            value={filters.language}
            disabled={!filters.project}
            onChange={(e) => { setFilters({ ...filters, language: e.target.value }); setSelectedPool([]); setSelectedTranscriberQueue([]); }}
          />
          <datalist id="review-languages">
            {languages.map((language) => <option key={language} value={language} />)}
          </datalist>
        </div>
        {!isTranscriberQueuePage && <div>
          <label>Reviewer owner</label>
          <select value={bulkReviewer} onChange={(e) => setBulkReviewer(e.target.value)}>
            <option value="">Select reviewer</option>
            {eligibleReviewers.map((reviewer) => <option key={reviewer._id} value={reviewer._id}>{reviewer.name} - {reviewer.loginId}</option>)}
          </select>
        </div>}
        {isTranscriberQueuePage && <div>
          <label>Transcriber owner</label>
          <select value={bulkTranscriber} onChange={(e) => setBulkTranscriber(e.target.value)}>
            <option value="">Select transcriber</option>
            {eligibleTranscribers.map((transcriber) => <option key={transcriber._id} value={transcriber._id}>{userLabel(transcriber)}</option>)}
          </select>
        </div>}
        {!isTranscriberQueuePage && <button className="btn-primary h-10 self-end" onClick={assignReviewer}><UserCheck size={15} /> Assign Reviewer</button>}
        {isTranscriberQueuePage && <button className="btn-primary h-10 self-end" onClick={assignTranscriber}><UserCheck size={15} /> Assign Transcriber</button>}
      </div>
      <p className="mt-4 flex gap-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900"><ShieldCheck size={16} className="mt-0.5 shrink-0" /> Assignment changes update queue ownership and downstream visibility for selected files.</p>
    </section>}

    {canManageReviewPool && <section className={`grid gap-3 ${isTranscriberQueuePage ? 'md:grid-cols-1' : 'md:grid-cols-5'}`}>
      {isTranscriberQueuePage && <SummaryCard label="Transcriber Queue" value={filteredTranscriberQueue.length} />}
      {!isTranscriberQueuePage && <SummaryCard label="Review Queue" value={filteredPool.length} />}
      {!isTranscriberQueuePage && <SummaryCard label="Assigned Files" value={reviewerWork.length} />}
      {!isTranscriberQueuePage && <SummaryCard label="Review Agents" value={reviewerCount} />}
      {!isTranscriberQueuePage && <SummaryCard label="Transcribers" value={transcriberCount} />}
    </section>}

    {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}

    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <section className="space-y-4">
        {user?.role === 'tl' && isTranscriberQueuePage && <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Transcriber Queue</h3>
              <p className="text-sm text-slate-500">{filteredTranscriberQueue.length} file(s) awaiting transcriber ownership</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input className="h-4 w-4" type="checkbox" checked={allTranscriberQueueSelected} onChange={(e) => toggleAllTranscriberQueue(e.target.checked)} />
              Select all
            </label>
          </div>
          {!filteredTranscriberQueue.length ? <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">No transcriber queue files match the selected project and language criteria.</p> : <div className="space-y-2">
            {filteredTranscriberQueue.map((job) => <div key={job._id} className="cursor-pointer rounded-md border p-3 hover:bg-slate-50" onClick={() => open(job)}>
              <div className="flex items-start gap-3">
                <input className="mt-1 h-4 w-4" type="checkbox" checked={selectedTranscriberQueue.includes(job._id)} onClick={(e) => e.stopPropagation()} onChange={(e) => toggleTranscriberQueueSelection(job._id, e.target.checked)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate font-semibold">{job.originalFileName}</p>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{job.project?.name || '-'} - {job.language || '-'}</p>
                  {(job.tlAssignedBy || job.tlAssignedAt) && <p className="mt-1 text-xs text-slate-400">Sent by {userLabel(job.tlAssignedBy, 'Admin')}{job.tlAssignedAt ? ` at ${new Date(job.tlAssignedAt).toLocaleString()}` : ''}</p>}
                </div>
              </div>
            </div>)}
          </div>}
        </section>}

        {canManageReviewPool && !isTranscriberQueuePage && <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">Review Queue</h3>
              <p className="text-sm text-slate-500">{filteredPool.length} file(s) awaiting reviewer ownership</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input className="h-4 w-4" type="checkbox" checked={allPoolSelected} onChange={(e) => toggleAllPool(e.target.checked)} />
              Select all
            </label>
          </div>
          {!filteredPool.length ? <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">No submitted files match the selected project and language criteria.</p> : <div className="space-y-2">
            {filteredPool.map((job) => <div key={job._id} className="cursor-pointer rounded-md border p-3 hover:bg-slate-50" onClick={() => open(job)}>
              <div className="flex items-start gap-3">
                <input className="mt-1 h-4 w-4" type="checkbox" checked={selectedPool.includes(job._id)} onClick={(e) => e.stopPropagation()} onChange={(e) => togglePoolSelection(job._id, e.target.checked)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate font-semibold">{job.originalFileName}</p>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{job.project?.name || '-'} - {job.language || '-'}</p>
                </div>
              </div>
            </div>)}
          </div>}
        </section>}

      {!canManageReviewPool && <ReviewList title={search ? `Search: ${search}` : 'My Review Work'} subtitle="Click a file to start review" jobs={visibleReviewerJobs} empty="No assigned review files.">
          {(job) => <button className="btn-muted mt-3 w-full" onClick={() => open(job)}>Review</button>}
        </ReviewList>}
      </section>

      <section className="panel p-4">
        {!active ? <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-center">
          <div>
            <ClipboardCheck className="mx-auto text-slate-400" size={24} />
            <p className="mt-2 text-sm font-semibold text-slate-600">Select a file to inspect assignment details</p>
            <p className="mt-1 text-xs text-slate-500">Ownership, queue status, and workspace access will appear here.</p>
          </div>
        </div> : <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold">{active.originalFileName}</h3>
              <p className="mt-1 text-sm text-slate-500">{active.project?.name || '-'} - {active.language || '-'} - Reviewer: {userLabel(active.reviewer)}</p>
              <p className="mt-1 text-sm text-slate-500">TL: {userLabel(active.assignedTl, 'No TL')}</p>
              <p className="mt-1 text-sm text-slate-500">Transcriber: {userLabel(active.assignedTranscriber)}</p>
              {(active.tlAssignedBy || active.tlAssignedAt) && <p className="mt-1 text-xs text-slate-400">TL assigned by {userLabel(active.tlAssignedBy, 'Admin')}{active.tlAssignedAt ? ` at ${new Date(active.tlAssignedAt).toLocaleString()}` : ''}</p>}
              {(active.reviewerAssignedBy || active.reviewerAssignedAt) && <p className="mt-1 text-xs text-slate-400">Reviewer sent by {active.reviewerAssignedBy?.name || 'TL'}{active.reviewerAssignedAt ? ` at ${new Date(active.reviewerAssignedAt).toLocaleString()}` : ''}</p>}
              {(active.transcriberAssignedBy || active.transcriberAssignedAt) && <p className="mt-1 text-xs text-slate-400">Transcriber assigned by {active.transcriberAssignedBy?.name || 'Admin'}{active.transcriberAssignedAt ? ` at ${new Date(active.transcriberAssignedAt).toLocaleString()}` : ''}</p>}
            </div>
            <div className="flex gap-2">
              <StatusBadge status={active.status} />
              <Link className="btn-muted" to={`/transcriber/work/${active._id}`}>Open audio workspace</Link>
            </div>
          </div>

        </div>}
      </section>
    </div>
  </div>;
}

function SummaryCard({ label, value }) {
  return <div className="panel p-4">
    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
  </div>;
}

function userLabel(user, fallback = '-') {
  if (!user) return fallback;
  return user.loginId ? `${user.name} (${user.loginId})` : user.name || fallback;
}

function ReviewList({ title, subtitle, jobs, empty, children }) {
  return <section className="panel p-4">
    <div className="mb-3">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
    {!jobs.length ? <p className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">{empty}</p> : <div className="space-y-2">
      {jobs.map((job) => <div key={job._id} className="rounded-md border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{job.originalFileName}</p>
            <p className="mt-1 text-sm text-slate-500">{job.project?.name || '-'} - {job.language || '-'}</p>
            <p className="mt-1 text-xs text-slate-500">Reviewer: {userLabel(job.reviewer, 'No reviewer')} - Transcriber: {userLabel(job.assignedTranscriber)}</p>
            {(job.reviewerAssignedBy || job.reviewerAssignedAt) && <p className="mt-1 text-xs text-slate-400">Sent by {job.reviewerAssignedBy?.name || 'TL'}{job.reviewerAssignedAt ? ` at ${new Date(job.reviewerAssignedAt).toLocaleString()}` : ''}</p>}
          </div>
          <StatusBadge status={job.status} />
        </div>
        {children(job)}
      </div>)}
    </div>}
  </section>;
}
