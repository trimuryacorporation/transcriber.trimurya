import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle2, Clock3, Download, ExternalLink, FileAudio, FolderKanban, Headphones, Layers3, ListChecks, RotateCcw, Send, Timer, UserCheck } from 'lucide-react';
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

const cardMeta = {
  totalProjects: { Icon: FolderKanban, tone: 'text-blue-700 bg-blue-50', helper: 'Configured workspaces' },
  totalAudioFiles: { Icon: FileAudio, tone: 'text-cyan-700 bg-cyan-50', helper: 'Files in operation' },
  totalAudioDuration: { Icon: Timer, tone: 'text-indigo-700 bg-indigo-50', helper: 'Total processing scope' },
  activeTranscribers: { Icon: UserCheck, tone: 'text-emerald-700 bg-emerald-50', helper: 'Available production users' },
  unassignedFiles: { Icon: AlertTriangle, tone: 'text-amber-700 bg-amber-50', helper: 'Requires assignment' },
  assignedFiles: { Icon: ListChecks, tone: 'text-blue-700 bg-blue-50', helper: 'Assigned to team members' },
  liveWorkFiles: { Icon: Headphones, tone: 'text-teal-700 bg-teal-50', helper: 'Ready for active work' },
  inProgressFiles: { Icon: Clock3, tone: 'text-indigo-700 bg-indigo-50', helper: 'Currently in progress' },
  submittedFiles: { Icon: Send, tone: 'text-purple-700 bg-purple-50', helper: 'Awaiting review action' },
  approvedFiles: { Icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50', helper: 'Completed successfully' },
  returnedFiles: { Icon: RotateCcw, tone: 'text-orange-700 bg-orange-50', helper: 'Sent for correction' },
  rejectedFiles: { Icon: AlertTriangle, tone: 'text-red-700 bg-red-50', helper: 'Requires management attention' }
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
  const dashboardTitle = user?.role === 'reviewer' ? 'Reviewer Reports' : user?.role === 'tl' ? 'Team Leader Dashboard' : 'Admin Dashboard';
  const summary = {
    total: Number(cards.totalAudioFiles || 0),
    active: Number(cards.liveWorkFiles || 0) + Number(cards.inProgressFiles || 0),
    review: Number(cards.submittedFiles || 0),
    exceptions: Number(cards.returnedFiles || 0) + Number(cards.rejectedFiles || 0) + Number(cards.unassignedFiles || 0)
  };
  return <div className="space-y-5">
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Operations Command Center</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">{dashboardTitle}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Monitor assignment flow, transcription throughput, review outcomes, and operational exceptions across active audio work.
          </p>
        </div>
        {['admin', 'tl'].includes(user?.role) && (canDownloadReport
          ? <a className="btn-primary h-10" href={downloadUrl('/reports/download')} download><Download size={16} /> Download Report</a>
          : <button className="btn-muted h-10" disabled title="Report download is disabled"><Download size={16} /> Download Report</button>)}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem label="Total files" value={summary.total} />
        <SummaryItem label="Active workload" value={summary.active} />
        <SummaryItem label="Pending review" value={summary.review} />
        <SummaryItem label="Exceptions" value={summary.exceptions} alert={summary.exceptions > 0} />
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {visibleCards.map(([key, value]) => <MetricCard key={key} metricKey={key} value={value} />)}
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <Chart title="Completed Audio Duration" description="Daily approved audio volume" data={charts.data?.dailyCompleted || []}><AreaChart data={charts.data?.dailyCompleted || []}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="_id" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip /><Area dataKey="duration" fill="#12325f" fillOpacity={0.16} stroke="#12325f" strokeWidth={2} /></AreaChart></Chart>
      <Chart title="Transcriber Productivity" description="Approved duration by user" data={charts.data?.productivity || []}><BarChart data={charts.data?.productivity || []}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="user" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="approvedDuration" fill="#f4b400" radius={[6, 6, 0, 0]} /></BarChart></Chart>
      <Chart title="Review Outcomes" description="Approval and rejection distribution" data={charts.data?.reviewRate || []}><PieChart><Tooltip /><Pie data={charts.data?.reviewRate || []} dataKey="count" nameKey="_id" fill="#12325f" label /></PieChart></Chart>
      <Chart title="Project Progress" description="File status volume by project" data={charts.data?.projectProgress || []}><BarChart data={charts.data?.projectProgress || []}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="project" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="count" fill="#0f766e" radius={[6, 6, 0, 0]} /></BarChart></Chart>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <ReportFileList title="Submitted Files" files={lists.submittedFiles || []} openFile={openFile} setOpenFile={setOpenFile} />
      <ReportFileList title="Rejected Files" files={lists.rejectedFiles || []} openFile={openFile} setOpenFile={setOpenFile} />
    </div>
  </div>;
}

function SummaryItem({ label, value, alert = false }) {
  return <div className={`rounded-md border px-4 py-3 ${alert ? 'border-red-100 bg-red-50 text-red-900' : 'border-slate-200 bg-slate-50 text-slate-900'}`}>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-xl font-bold">{Number(value || 0).toLocaleString()}</p>
  </div>;
}

function MetricCard({ metricKey, value }) {
  const meta = cardMeta[metricKey] || { Icon: Layers3, tone: 'text-slate-700 bg-slate-100', helper: 'Operational metric' };
  const Icon = meta.Icon;
  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{cardLabels[metricKey] || metricKey.replace(/([A-Z])/g, ' $1')}</p>
        <p className="mt-2 text-3xl font-bold text-slate-950">{Number(value || 0).toLocaleString()}</p>
      </div>
      <div className={`grid h-10 w-10 place-items-center rounded-md ${meta.tone}`}>
        <Icon size={19} />
      </div>
    </div>
    <p className="mt-3 text-xs font-medium text-slate-500">{meta.helper}</p>
  </div>;
}

function Chart({ title, description, data, children }) {
  const hasData = Array.isArray(data) && data.length > 0;
  return <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
    <div className="mb-4">
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
    <div className="h-72">
      {hasData ? <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer> : <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50">
        <div className="text-center">
          <Layers3 className="mx-auto text-slate-400" size={24} />
          <p className="mt-2 text-sm font-semibold text-slate-600">No chart data available</p>
          <p className="mt-1 text-xs text-slate-500">Metrics will appear as work progresses.</p>
        </div>
      </div>}
    </div>
  </section>;
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
