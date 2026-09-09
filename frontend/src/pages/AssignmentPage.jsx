import React, { useEffect, useMemo, useState } from 'react';
import { Filter, RefreshCw, UserCheck } from 'lucide-react';
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold">Audio Assignment</h2>
        <p className="mt-1 text-sm text-slate-500">Assign reviewer work by project and language.</p>
      </div>
      <button className="btn-muted" onClick={() => load()}><RefreshCw size={16} /> Refresh</button>
    </div>

    <form onSubmit={applyFilters} className="panel grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto]">
      <div>
        <label>Project</label>
        <select value={filters.project} onChange={(e) => setFilters({ ...filters, project: e.target.value })}>
          <option value="">All projects</option>
          {projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
        </select>
      </div>
      <div>
        <label>Language</label>
        <select value={filters.language} onChange={(e) => setFilters({ ...filters, language: e.target.value })}>
          <option value="">All languages</option>
          {languages.map((language) => <option key={language} value={language}>{language}</option>)}
        </select>
      </div>
      <button className="btn-primary self-end"><Filter size={16} /> Filter</button>
    </form>

    <form onSubmit={submit} className="panel grid gap-3 p-4 md:grid-cols-6">
      <div>
        <label>TL</label>
        <select value={form.assignedTl || ''} onChange={(e) => setForm({ ...form, assignedTl: e.target.value })}>
          <option value="">No change</option>
          {tls.map((user) => <option key={user._id} value={user._id}>{userLabel(user)}</option>)}
        </select>
      </div>
      <div>
        <label>Transcriber</label>
        <select value={form.assignedTranscriber || ''} onChange={(e) => setForm({ ...form, assignedTranscriber: e.target.value })}>
          <option value="">No change</option>
          {transcribers.map((user) => <option key={user._id} value={user._id}>{userLabel(user)}</option>)}
        </select>
      </div>
      <div>
        <label>Reviewer</label>
        <select value={form.reviewer || ''} onChange={(e) => setForm({ ...form, reviewer: e.target.value })}>
          <option value="">No change</option>
          {reviewers.map((user) => <option key={user._id} value={user._id}>{userLabel(user)}</option>)}
        </select>
      </div>
      <div>
        <label>Priority</label>
        <select value={form.priority || ''} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
          <option value="">No change</option>
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
      <button className="btn-accent self-end"><UserCheck size={16} /> Assign selected</button>
    </form>

    {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}

    <div className="panel overflow-x-auto">
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
          {!jobs.length && <tr><td className="table-td text-slate-500" colSpan={8}>No audio files match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}

function userLabel(user, fallback = '-') {
  if (!user) return fallback;
  return user.loginId ? `${user.name} (${user.loginId})` : user.name || fallback;
}
