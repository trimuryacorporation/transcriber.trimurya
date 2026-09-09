import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useFetch } from '../hooks/useFetch.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

const dashboardCards = [
  { label: 'Rejected', statuses: ['Rejected'], tone: 'text-red-800' },
  { label: 'Assigned', statuses: ['Assigned'], tone: 'text-blue-800' },
  { label: 'In Progress', statuses: ['In Progress', 'Draft Saved'], tone: 'text-indigo-800' },
  { label: 'Correction', statuses: ['Returned for Correction'], tone: 'text-orange-800' }
];

const editableStatuses = new Set(['Assigned', 'In Progress', 'Draft Saved', 'Returned for Correction', 'Rejected']);

export function TranscriberDashboard() {
  const { data } = useFetch('/audio?limit=100', []);
  const items = data?.items || [];
  const counts = items.reduce((acc, job) => ({ ...acc, [job.status]: (acc[job.status] || 0) + 1 }), {});

  return <div className="space-y-5">
    <h2 className="text-2xl font-bold">Transcriber Dashboard</h2>
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      {dashboardCards.map((card) => {
        const value = card.statuses.reduce((total, status) => total + (counts[status] || 0), 0);
        return <div className="panel p-4" key={card.label}>
          <p className="text-sm text-slate-500">{card.label}</p>
          <p className={`text-3xl font-bold ${card.tone}`}>{value}</p>
        </div>;
      })}
    </div>
    <section className="panel overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-semibold">Recent Work</h3>
      </div>
      {!items.length ? <EmptyState title="No assigned audio" /> : <div className="divide-y divide-slate-100">
        {items.slice(0, 8).map((job) => <WorkRow job={job} key={job._id} />)}
      </div>}
    </section>
  </div>;
}

export function AssignedWorkPage() {
  const location = useLocation();
  const search = new URLSearchParams(location.search).get('search') || '';
  const { data } = useFetch(`/audio?limit=100&search=${encodeURIComponent(search)}`, [search]);
  const items = data?.items || [];

  return <div className="space-y-5">
    <h2 className="text-2xl font-bold">{search ? `Search: ${search}` : 'Assigned Work'}</h2>
    {!items.length ? <EmptyState title="No assigned audio" /> : <div className="grid gap-3">
      {items.map((job) => <Link key={job._id} to={`/transcriber/work/${job._id}`} className="panel flex items-center justify-between gap-3 p-4 hover:border-primary">
        <div className="min-w-0">
          <p className="truncate font-semibold">{job.originalFileName}</p>
          <p className="text-sm text-slate-500">{job.project?.name} - {job.language}</p>
          <p className="text-xs font-medium text-slate-500">{editableStatuses.has(job.status) ? 'Editable now' : 'Read-only until review decision'}</p>
        </div>
        <StatusBadge status={job.status} />
      </Link>)}
    </div>}
  </div>;
}

function WorkRow({ job }) {
  return <Link to={`/transcriber/work/${job._id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
    <div className="min-w-0">
      <p className="truncate font-semibold">{job.originalFileName}</p>
      <p className="text-sm text-slate-500">{editableStatuses.has(job.status) ? 'Editable' : 'Pending reviewer/admin action'}</p>
    </div>
    <StatusBadge status={job.status} />
  </Link>;
}
