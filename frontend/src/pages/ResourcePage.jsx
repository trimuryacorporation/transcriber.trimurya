import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { Archive, ClipboardCheck, Download, FileAudio, FolderKanban, KeyRound, Plus, Search, ShieldCheck, Trash2, UsersRound } from 'lucide-react';
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
  const pageMeta = {
    files: {
      eyebrow: 'Audio Repository',
      description: 'Monitor uploaded source audio, open transcription workspaces, and export transcript deliverables in approved formats.',
      Icon: FileAudio
    },
    projects: {
      eyebrow: 'Project Governance',
      description: 'Maintain client project records, language scope, and transcription guidelines used across production workflows.',
      Icon: FolderKanban
    },
    team: {
      eyebrow: 'Workforce Administration',
      description: 'Manage operational users, role access, and team availability for transcription and review queues.',
      Icon: UsersRound
    }
  }[kind];
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
  const PageIcon = pageMeta.Icon;
  const fileSummary = kind === 'files' ? {
    total: items.length,
    active: items.filter((item) => !['Approved', 'Archived'].includes(item.status)).length,
    exceptions: items.filter((item) => ['Rejected', 'Returned for Correction'].includes(item.status)).length
  } : null;
  const recordSummary = kind !== 'files' ? {
    total: items.length,
    active: items.filter((item) => item.isActive !== false).length,
    inactive: items.filter((item) => item.isActive === false).length
  } : null;
  return <div className="space-y-5">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-blue-50 text-primary"><PageIcon size={22} /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{pageMeta.eyebrow}</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{pageMeta.description}</p>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex w-full gap-2 sm:w-auto">
          <input className="sm:w-72" placeholder={kind === 'files' ? 'Search files or projects' : 'Search records'} value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn-muted h-10"><Search size={16} /> Search</button>
        </form>
      </div>
      {(fileSummary || recordSummary) && <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {fileSummary ? <>
          <SummaryTile label="Visible files" value={fileSummary.total} />
          <SummaryTile label="Active workload" value={fileSummary.active} />
          <SummaryTile label="Exceptions" value={fileSummary.exceptions} emphasis={fileSummary.exceptions > 0} />
        </> : <>
          <SummaryTile label="Total records" value={recordSummary.total} />
          <SummaryTile label="Active records" value={recordSummary.active} />
          <SummaryTile label="Inactive records" value={recordSummary.inactive} emphasis={recordSummary.inactive > 0} />
        </>}
      </div>}
    </section>
    {kind === 'team' && <section className="grid gap-4 xl:grid-cols-3">
      <GuidanceCard title="Role Governance" body="Assign the minimum role required for the user to complete transcription, review, or administration responsibilities." />
      <GuidanceCard title="Credential Control" body="Use temporary credentials for onboarding and require users to update passwords after first access." />
      <GuidanceCard title="Queue Visibility" body="Active user records can appear in assignment, review, and reporting workflows based on their role." />
    </section>}

    {kind !== 'files' && canCreateTeam && <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-200 pb-4">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-primary"><ClipboardCheck size={19} /></div>
        <div>
          <h3 className="font-bold text-slate-950">{kind === 'team' ? 'Provision Team Access' : 'Create Project Record'}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {kind === 'team'
              ? 'Create a controlled user record with login identity, operational role, and initial onboarding credential.'
              : 'Define the client, language, and working guidance that will govern assignment and transcription quality.'}
          </p>
        </div>
      </div>
      <form onSubmit={create} className="grid gap-4 md:grid-cols-4">
        <div>
          <label>{kind === 'team' ? 'Full name' : 'Project name'}</label>
          <input className="mt-1.5" placeholder={kind === 'team' ? 'Enter user name' : 'Enter project name'} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        {kind === 'team' ? <>
          <div><label>Login ID</label><input className="mt-1.5" placeholder="Unique login identifier" value={form.loginId || ''} onChange={(e) => setForm({ ...form, loginId: e.target.value })} required /></div>
          <div><label>Email address</label><input className="mt-1.5" placeholder="name@example.com" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div><label>Access role</label><select className="mt-1.5" value={form.role || 'transcriber'} onChange={(e) => setForm({ ...form, role: e.target.value })}>{teamRoleOptions.map((role) => <option key={role}>{role}</option>)}</select></div>
          <div className="md:col-span-4"><label>Initial password</label><input className="mt-1.5" placeholder="Temporary credential for first access" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        </> : <>
          <div><label>Client</label><input className="mt-1.5" placeholder="Client or business unit" value={form.client || ''} onChange={(e) => setForm({ ...form, client: e.target.value })} /></div>
          <div><label>Primary language</label><input className="mt-1.5" placeholder="English" value={form.language || ''} onChange={(e) => setForm({ ...form, language: e.target.value })} /></div>
          <div><label>Transcription guidelines</label><input className="mt-1.5" placeholder="Quality notes or project-specific instructions" value={form.guidelines || ''} onChange={(e) => setForm({ ...form, guidelines: e.target.value })} /></div>
        </>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 md:col-span-4">
          <p className="text-sm text-slate-500">
            {kind === 'team' ? 'New users are created as active records and can be managed from the team table.' : 'New projects become available for upload intake, assignment, and reporting workflows.'}
          </p>
          <button className="btn-primary h-10 px-5"><Plus size={16} /> {kind === 'team' ? 'Create Access Record' : 'Create Project Record'}</button>
        </div>
      </form>
    </section>}
    {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {!items.length ? <EmptyState /> : <section className="rounded-lg border border-slate-200 bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="font-bold text-slate-950">{kind === 'files' ? 'Managed Audio Files' : kind === 'team' ? 'Access Directory' : 'Managed Projects'}</h3>
          <p className="mt-1 text-sm text-slate-500">{kind === 'files' ? 'Open workspaces and export transcript assets from one controlled repository.' : kind === 'team' ? 'Review active users, assigned roles, login identities, and availability for operational workflows.' : 'Review and maintain active operational records.'}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"><ShieldCheck size={16} /> {items.length} record(s)</div>
      </div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr>{columns.map((c) => <th className="table-th" key={c}>{columnLabel(c)}</th>)}<th className="table-th">Actions</th></tr></thead><tbody>{items.map((item) => <tr className="border-t border-slate-100" key={item._id}>{columns.map((c) => <td className="table-td" key={c}>{renderCell(item, c)}</td>)}<td className="table-td"><ResourceActions kind={kind} item={item} user={user} toggleActive={toggleActive} archiveOrDelete={archiveOrDelete} /></td></tr>)}</tbody></table></div>
    </section>}
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

function SummaryTile({ label, value, emphasis = false }) {
  return <div className={`rounded-md border px-4 py-3 ${emphasis ? 'border-red-100 bg-red-50 text-red-950' : 'border-slate-200 bg-slate-50 text-slate-950'}`}>
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold">{Number(value || 0).toLocaleString()}</p>
  </div>;
}

function GuidanceCard({ title, body }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
    <div className="mb-3 grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-primary"><KeyRound size={17} /></div>
    <h3 className="font-bold text-slate-950">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
  </section>;
}

function columnLabel(key) {
  const labels = {
    originalFileName: 'Source File',
    assignedTranscriber: 'Assigned Transcriber',
    isActive: 'Availability',
    loginId: 'Login ID',
    role: 'Access Role'
  };
  return labels[key] || key.replace(/([A-Z])/g, ' $1');
}

function ResourceActions({ kind, item, user, toggleActive, archiveOrDelete }) {
  if (kind === 'files') {
    return <div className="flex flex-wrap gap-2">
      <Link className="btn-primary h-9" to={`/transcriber/work/${item._id}`}>Open Workspace</Link>
      <div className="flex flex-wrap gap-2">
        {['csv', 'json', 'txt', 'srt', 'vtt'].map((format) => <a key={format} className="btn-muted h-9" href={downloadUrl(`/exports/${item._id}/${format}`)} download><Download size={14} /> {format.toUpperCase()}</a>)}
      </div>
    </div>;
  }
  if (user?.role !== 'admin') return <span className="text-sm text-slate-500">No actions available</span>;
  return <div className="flex flex-wrap gap-2">
    <button className="btn-muted h-9" onClick={() => toggleActive(item)}>{item.isActive ? <><Archive size={15} /> Deactivate</> : 'Activate'}</button>
    <button className="btn-muted h-9 text-red-700" onClick={() => archiveOrDelete(item)}><Trash2 size={16} /> Delete</button>
  </div>;
}
