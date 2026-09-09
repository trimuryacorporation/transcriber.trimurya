import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { Download, Plus, Search, Trash2 } from 'lucide-react';
import { api, downloadUrl } from '../api/client.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';

const endpoints = {
  projects: '/projects',
  files: '/audio',
  team: '/users'
};

export function ResourcePage({ kind }) {
  const { user } = useAuth();
  const location = useLocation();
  const urlSearch = useMemo(() => new URLSearchParams(location.search).get('search') || '', [location.search]);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState(urlSearch);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [pendingChange, setPendingChange] = useState(null);
  const settings = useFetch(kind === 'team' && user?.role === 'tl' ? '/settings' : null, [kind, user?.role]);
  const title = kind === 'team' ? 'Team Management' : kind === 'files' ? 'Audio File Management' : 'Project Management';
  const canCreateTeam = kind !== 'team' || user?.role === 'admin' || (user?.role === 'tl' && settings.data?.settings?.allowTlTeamCreate);
  const teamRoleOptions = user?.role === 'tl' ? ['transcriber', 'reviewer'] : ['transcriber', 'reviewer', 'tl', 'admin'];
  const load = async (nextSearch = search) => {
    const res = await api.get(`${endpoints[kind]}?search=${encodeURIComponent(nextSearch)}`);
    setItems(res.data.items || []);
  };
  useEffect(() => {
    setSearch(urlSearch);
    load(urlSearch).catch((err) => setError(err.response?.data?.message || err.message));
  }, [kind, urlSearch]);
  const columns = useMemo(() => kind === 'team' ? ['name', 'loginId', 'email', 'role', 'isActive'] : kind === 'files' ? ['originalFileName', 'project', 'assignedTranscriber', 'status', 'deadline'] : ['name', 'client', 'language', 'isActive'], [kind]);
  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = kind === 'team' ? { ...form, isActive: true } : { ...form, language: form.language || 'English' };
      await api.post(endpoints[kind], payload);
      setForm({});
      await load();
    } catch (err) { setError(err.response?.data?.message || err.message); }
  };
  const archiveOrDelete = (item) => {
    setPendingChange(item);
  };
  const confirmChange = async () => {
    if (!pendingChange) return;
    setError('');
    try {
      if (kind === 'files') await api.delete(`/audio/${pendingChange._id}`);
      else await api.delete(`${endpoints[kind]}/${pendingChange._id}`);
      setPendingChange(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    }
  };
  const toggleActive = async (item) => {
    await api.patch(`${endpoints[kind]}/${item._id}`, { isActive: !item.isActive });
    await load();
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold">{title}</h2><form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2"><input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} /><button className="btn-muted"><Search size={16} /></button></form></div>
    {kind !== 'files' && canCreateTeam && <form onSubmit={create} className="panel grid gap-3 p-4 md:grid-cols-4">
      <input placeholder="Name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      {kind === 'team' ? <><input placeholder="Login ID" value={form.loginId || ''} onChange={(e) => setForm({ ...form, loginId: e.target.value })} required /><input placeholder="Email" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} required /><select value={form.role || 'transcriber'} onChange={(e) => setForm({ ...form, role: e.target.value })}>{teamRoleOptions.map((role) => <option key={role}>{role}</option>)}</select><input placeholder="Initial password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} /></> : <><input placeholder="Client" value={form.client || ''} onChange={(e) => setForm({ ...form, client: e.target.value })} /><input placeholder="Language" value={form.language || ''} onChange={(e) => setForm({ ...form, language: e.target.value })} /><input placeholder="Guidelines" value={form.guidelines || ''} onChange={(e) => setForm({ ...form, guidelines: e.target.value })} /></>}
      <button className="btn-accent md:col-span-4"><Plus size={16} /> Create</button>
    </form>}
    {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!items.length ? <EmptyState /> : <div className="panel overflow-x-auto"><table className="w-full"><thead><tr>{columns.map((c) => <th className="table-th" key={c}>{c}</th>)}<th className="table-th">Actions</th></tr></thead><tbody>{items.map((item) => <tr className="border-t border-slate-100" key={item._id}>{columns.map((c) => <td className="table-td" key={c}>{renderCell(item, c)}</td>)}<td className="table-td"><div className="flex gap-2">{kind === 'files' && <Link className="btn-muted" to={`/transcriber/work/${item._id}`}>Open</Link>}{kind === 'files' && ['csv', 'json', 'txt', 'srt', 'vtt'].map((f) => <a key={f} className="btn-muted" href={downloadUrl(`/exports/${item._id}/${f}`)} download><Download size={14} />{f}</a>)}{kind !== 'files' && user?.role === 'admin' && <button className="btn-muted" onClick={() => toggleActive(item)}>{item.isActive ? 'Deactivate' : 'Activate'}</button>}{kind !== 'files' && user?.role === 'admin' && <button className="btn-muted text-red-700" onClick={() => archiveOrDelete(item)}><Trash2 size={16} /></button>}</div></td></tr>)}</tbody></table></div>}
    {pendingChange && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-950">Confirm change</h3>
        <p className="mt-2 text-sm text-slate-600">
          Are you sure you want to permanently delete <span className="font-semibold text-slate-900">{pendingChange.originalFileName || pendingChange.name}</span>?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-muted" onClick={() => setPendingChange(null)}>Cancel</button>
          <button className="btn-primary" onClick={confirmChange}>Confirm</button>
        </div>
      </div>
    </div>}
  </div>;
}

function renderCell(item, key) {
  const val = item[key];
  if (key === 'status') return <StatusBadge status={val} />;
  if (key === 'project' || key === 'assignedTranscriber') return val?.name || '-';
  if (key === 'isActive') return val ? 'Active' : 'Inactive';
  if (key === 'deadline') return val ? new Date(val).toLocaleDateString() : '-';
  return String(val ?? '-');
}
