import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Filter, RefreshCw, ShieldCheck, UserCheck, UsersRound } from 'lucide-react';
import { api } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.jsx';

export function AssignmentPage() {
  const [jobs, setJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [filters, setFilters] = useState({ project: '', language: '' });
  const [form, setForm] = useState({ priority: 'Normal' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const languages = useMemo(() => {
    const values = [...projects.map((project) => project.language), ...jobs.map((job) => job.language)]
      .filter(Boolean)
      .map((value) => value.trim());
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }, [projects, jobs]);

  const reviewers = useMemo(() => users.filter((user) => {
    if (user.role !== 'reviewer') return false;
    if (!filters.language) return true;
    if (!user.languages?.length) return true;
    return user.languages.some((language) => language.toLowerCase() === filters.language.toLowerCase());
  }), [users, filters.language]);

  const tls = users.filter((user) => user.role === 'tl');
  const transcribers = users.filter((user) => user.role === 'transcriber');
  const allSelected = jobs.length > 0 && jobs.every((job) => selected.includes(job._id));
  const actionableJobs = jobs.filter((job) => !['Approved', 'Archived'].includes(job.status));

  async function load(nextFilters = filters) {
    setError('');
    const params = new URLSearchParams({ limit: '100' });
    if (nextFilters.project) params.set('project', nextFilters.project);
    if (nextFilters.language) params.set('language', nextFilters.language);
    try {
      const [j, p, u] = await Promise.all([
        api.get(`/audio?${params.toString()}`),
        api.get('/projects?limit=100'),
        api.get('/users?limit=100')
      ]);
      setJobs(j.data.items || []);
      setProjects(p.data.items || []);
      setUsers(u.data.items || []);
      setSelected((current) => current.filter((id) => (j.data.items || []).some((job) => job._id === id)));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function applyFilters(e) {
    e.preventDefault();
    await load(filters);
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!selected.length) {
      setError('Select at least one audio file.');
      return;
    }
    if (!form.assignedTl && !form.assignedTranscriber && !form.reviewer && !form.priority && !form.deadline) {
      setError('Choose a TL, transcriber, reviewer, priority, or deadline to assign.');
      return;
    }
    try {
      const res = await api.post('/audio/assign', { ...form, jobIds: selected });
      setMessage(`${res.data.modified || selected.length} file(s) updated.`);
      setSelected([]);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  }

  function toggleAll(checked) {
    setSelected(checked ? jobs.map((job) => job._id) : []);
  }

  function toggleOne(id, checked) {
    setSelected((current) => checked ? [...current, id] : current.filter((item) => item !== id));
  }

  return <div className="space-y-5">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Work Allocation</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Audio Assignment Control</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Route audio files to team leads, transcribers, and reviewers with clear priority, deadlines, and ownership for every production queue.
          </p>
        </div>
        <button className="btn-muted h-10" onClick={() => load()}><RefreshCw size={16} /> Refresh Queue</button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Visible files" value={jobs.length} />
        <SummaryTile label="Actionable files" value={actionableJobs.length} />
        <SummaryTile label="Selected for update" value={selected.length} emphasis={selected.length > 0} />
      </div>
    </section>

    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-primary"><Filter size={19} /></div>
        <div>
          <h3 className="font-bold text-slate-950">Queue Filters</h3>
          <p className="mt-1 text-sm text-slate-500">Narrow the assignment queue by project and language before applying bulk ownership changes.</p>
        </div>
      </div>
      <form onSubmit={applyFilters} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <div>
          <label>Project scope</label>
          <select value={filters.project} onChange={(e) => setFilters({ ...filters, project: e.target.value })}>
            <option value="">All projects</option>
            {projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
          </select>
        </div>
        <div>
          <label>Language scope</label>
          <select value={filters.language} onChange={(e) => setFilters({ ...filters, language: e.target.value })}>
            <option value="">All languages</option>
            {languages.map((language) => <option key={language} value={language}>{language}</option>)}
          </select>
        </div>
        <button className="btn-primary h-10 self-end"><Filter size={16} /> Apply Filters</button>
      </form>
    </section>

    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-700"><UsersRound size={19} /></div>
          <div>
            <h3 className="font-bold text-slate-950">Bulk Assignment Update</h3>
            <p className="mt-1 text-sm text-slate-500">Only selected rows will be updated. Leave any field unchanged when ownership should remain as-is.</p>
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{selected.length} file(s) selected</div>
      </div>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-6">
        <div>
          <label>Team lead</label>
          <select value={form.assignedTl || ''} onChange={(e) => setForm({ ...form, assignedTl: e.target.value })}>
            <option value="">Keep current</option>
            {tls.map((user) => <option key={user._id} value={user._id}>{userLabel(user)}</option>)}
          </select>
        </div>
        <div>
          <label>Transcriber</label>
          <select value={form.assignedTranscriber || ''} onChange={(e) => setForm({ ...form, assignedTranscriber: e.target.value })}>
            <option value="">Keep current</option>
            {transcribers.map((user) => <option key={user._id} value={user._id}>{userLabel(user)}</option>)}
          </select>
        </div>
        <div>
          <label>Reviewer</label>
          <select value={form.reviewer || ''} onChange={(e) => setForm({ ...form, reviewer: e.target.value })}>
            <option value="">Keep current</option>
            {reviewers.map((user) => <option key={user._id} value={user._id}>{userLabel(user)}</option>)}
          </select>
        </div>
        <div>
          <label>Priority</label>
          <select value={form.priority || ''} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="">Keep current</option>
            <option>Low</option>
            <option>Normal</option>
            <option>High</option>
            <option>Urgent</option>
          </select>
        </div>
        <div>
          <label>Deadline</label>
          <input type="date" value={form.deadline || ''} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
        </div>
        <button className="btn-primary h-10 self-end"><UserCheck size={16} /> Apply Assignment</button>
      </form>
      <p className="mt-4 flex gap-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900"><ShieldCheck size={16} className="mt-0.5 shrink-0" /> Assignment changes affect queue visibility, work ownership, and downstream review routing for the selected audio files.</p>
    </section>

    {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}

    <section className="rounded-lg border border-slate-200 bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="font-bold text-slate-950">Assignment Queue</h3>
          <p className="mt-1 text-sm text-slate-500">Select files that require ownership, reviewer, priority, or deadline updates.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"><ClipboardCheck size={16} /> {jobs.length} visible</div>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="table-th"><input className="h-4 w-4" type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} /></th>
            <th className="table-th">File</th>
            <th className="table-th">Project</th>
            <th className="table-th">Language</th>
            <th className="table-th">TL</th>
            <th className="table-th">Transcriber</th>
            <th className="table-th">Reviewer</th>
            <th className="table-th">Status</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => <tr className="border-t" key={job._id}>
            <td className="table-td"><input className="h-4 w-4" type="checkbox" checked={selected.includes(job._id)} onChange={(e) => toggleOne(job._id, e.target.checked)} /></td>
            <td className="table-td">{job.originalFileName}</td>
            <td className="table-td">{job.project?.name || '-'}</td>
            <td className="table-td">{job.language || '-'}</td>
            <td className="table-td">{userLabel(job.assignedTl)}</td>
            <td className="table-td">{job.assignedTranscriber?.name || '-'}</td>
            <td className="table-td">{job.reviewer?.name || '-'}</td>
            <td className="table-td"><StatusBadge status={job.status} /></td>
          </tr>)}
          {!jobs.length && <tr><td className="table-td text-slate-500" colSpan={8}>No assignment-ready audio files match the current filters.</td></tr>}
        </tbody>
      </table>
      </div>
    </section>
  </div>;
}

function SummaryTile({ label, value, emphasis = false }) {
  return <div className={`rounded-md border px-4 py-3 ${emphasis ? 'border-blue-100 bg-blue-50 text-blue-950' : 'border-slate-200 bg-slate-50 text-slate-950'}`}>
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold">{Number(value || 0).toLocaleString()}</p>
  </div>;
}

function userLabel(user, fallback = '-') {
  if (!user) return fallback;
  return user.loginId ? `${user.name} (${user.loginId})` : user.name || fallback;
}
