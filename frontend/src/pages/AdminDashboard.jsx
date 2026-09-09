import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, ExternalLink } from 'lucide-react';
import { downloadUrl } from '../api/client.js';
import { useFetch } from '../hooks/useFetch.js';
import { Skeleton } from '../components/Skeleton.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';

const cardOrder = [
  'totalProjects',
  'totalAudioFiles',
  'totalAudioDuration',
  'activeTranscribers',
  'unassignedFiles',
  'assignedFiles',
  'liveWorkFiles',
  'inProgressFiles',
  'submittedFiles',
  'approvedFiles',
  'returnedFiles',
  'rejectedFiles'
];

const cardLabels = {
  totalProjects: 'Total Projects',
  totalAudioFiles: 'Total Audio Files',
  totalAudioDuration: 'Total Audio Duration',
  activeTranscribers: 'Active Transcribers',
  unassignedFiles: 'Unassigned Files',
  assignedFiles: 'Assigned Files',
  liveWorkFiles: 'Live Work Files',
  inProgressFiles: 'In Progress Files',
  submittedFiles: 'Submitted Files',
  approvedFiles: 'Approved Files',
  returnedFiles: 'Returned Files',
  rejectedFiles: 'Rejected Files'
};

export function AdminDashboard() {
  const { user } = useAuth();
  const [openFile, setOpenFile] = useState(null);
  const { data, loading } = useFetch('/reports/dashboard', []);
  const charts = useFetch('/reports/charts', []);
  const settings = useFetch(['admin', 'tl'].includes(user?.role) ? '/settings' : null, [user?.role]);
  if (loading || charts.loading || settings.loading) return <Skeleton lines={8} />;
  const cards = data?.cards || {};
  const lists = data?.lists || {};
  const canDownloadReport = user?.role === 'admin' || (user?.role === 'tl' && settings.data?.settings?.allowTlReportDownload);
  const visibleCards = cardOrder
    .filter((key) => Object.prototype.hasOwnProperty.call(cards, key))
    .map((key) => [key, cards[key]]);
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-2xl font-bold">{user?.role === 'reviewer' ? 'Reviewer Reports' : user?.role === 'tl' ? 'TL Dashboard' : 'Admin Dashboard'}</h2>
      {['admin', 'tl'].includes(user?.role) && (canDownloadReport
        ? <a className="btn-primary" href={downloadUrl('/reports/download')} download><Download size={16} /> Download Report</a>
        : <button className="btn-muted" disabled title="Report download is disabled"><Download size={16} /> Download Report</button>)}
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {visibleCards.map(([key, value]) => <div key={key} className="panel p-4"><p className="text-xs uppercase text-slate-500">{cardLabels[key] || key.replace(/([A-Z])/g, ' $1')}</p><p className="mt-2 text-2xl font-bold">{Number(value).toLocaleString()}</p></div>)}
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <Chart title="Daily Completed Audio Duration"><AreaChart data={charts.data?.dailyCompleted || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="_id" /><YAxis /><Tooltip /><Area dataKey="duration" fill="#12325f" stroke="#12325f" /></AreaChart></Chart>
      <Chart title="Transcriber Productivity"><BarChart data={charts.data?.productivity || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="user" /><YAxis /><Tooltip /><Bar dataKey="approvedDuration" fill="#f4b400" /></BarChart></Chart>
      <Chart title="Approval and Rejection Rate"><PieChart><Tooltip /><Pie data={charts.data?.reviewRate || []} dataKey="count" nameKey="_id" fill="#12325f" label /></PieChart></Chart>
      <Chart title="Project Progress"><BarChart data={charts.data?.projectProgress || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="project" /><YAxis /><Tooltip /><Bar dataKey="count" fill="#0f766e" /></BarChart></Chart>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <ReportFileList title="Submitted Files" files={lists.submittedFiles || []} openFile={openFile} setOpenFile={setOpenFile} />
      <ReportFileList title="Rejected Files" files={lists.rejectedFiles || []} openFile={openFile} setOpenFile={setOpenFile} />
    </div>
  </div>;
}

function Chart({ title, children }) {
  return <section className="panel p-4"><h3 className="mb-3 font-semibold">{title}</h3><div className="h-72"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></section>;
}

function ReportFileList({ title, files, openFile, setOpenFile }) {
  return <section className="panel p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="font-semibold">{title}</h3>
      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{files.length}</span>
    </div>
    {!files.length ? <p className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">No files.</p> : <div className="space-y-2">
      {files.map((file) => {
        const expanded = openFile === file._id;
        return <div key={file._id} className="rounded-md border border-slate-200">
          <button className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-slate-50" onClick={() => setOpenFile(expanded ? null : file._id)}>
            <div className="min-w-0">
              <p className="truncate font-semibold">{file.originalFileName}</p>
              <p className="mt-1 text-xs text-slate-500">{file.project?.name || '-'} - {file.language || '-'} - {file.assignedTranscriber?.name || 'No transcriber'}</p>
            </div>
            <StatusBadge status={file.status} />
          </button>
          {expanded && <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3">
            <Link className="btn-primary" to={`/transcriber/work/${file._id}`}><ExternalLink size={15} /> Open Workspace</Link>
            <Link className="btn-muted" to="/admin/review">Review Queue</Link>
          </div>}
        </div>;
      })}
    </div>}
  </section>;
}
