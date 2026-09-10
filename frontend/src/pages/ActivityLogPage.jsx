import React from 'react';
import { Activity, Clock3, ShieldCheck, UserRound } from 'lucide-react';
import { useFetch } from '../hooks/useFetch.js';
import { Skeleton } from '../components/Skeleton.jsx';

export function ActivityLogPage() {
  const { data, loading } = useFetch('/activity?limit=100', []);
  if (loading) return <Skeleton />;
  const items = data.items || [];
  const uniqueActors = new Set(items.map((item) => item.actor?.name || 'System')).size;
  const latest = items[0]?.createdAt ? new Date(items[0].createdAt).toLocaleString() : '-';
  return <div className="space-y-5">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-blue-50 text-primary"><Activity size={22} /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Audit Trail</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Activity Log</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Review recent authentication, account, assignment, and workflow events captured for operational accountability.
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          <ShieldCheck size={16} />
          Audit visibility enabled
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Visible events" value={items.length} />
        <SummaryTile label="Unique actors" value={uniqueActors} />
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Latest event</p>
          <p className="mt-1 text-sm font-bold text-slate-950">{latest}</p>
        </div>
      </div>
    </section>

    <section className="rounded-lg border border-slate-200 bg-white shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="font-bold text-slate-950">Recent System Activity</h3>
          <p className="mt-1 text-sm text-slate-500">Showing the latest 100 audit events across users and workflow entities.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"><Clock3 size={16} /> Last updated now</div>
      </div>
      <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="table-th">Event time</th><th className="table-th">Actor</th><th className="table-th">Activity</th><th className="table-th">Entity</th></tr></thead><tbody>{items.map((a) => <tr key={a._id} className="border-t border-slate-100"><td className="table-td">{new Date(a.createdAt).toLocaleString()}</td><td className="table-td"><span className="inline-flex items-center gap-2"><UserRound size={15} className="text-slate-400" /> {a.actor?.name || 'System'}</span></td><td className="table-td"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{formatAction(a.action)}</span></td><td className="table-td">{formatEntity(a.entityType)}</td></tr>)}{!items.length && <tr><td className="table-td text-slate-500" colSpan={4}>No audit events are available for the current period.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}

function SummaryTile({ label, value }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-950">{Number(value || 0).toLocaleString()}</p>
  </div>;
}

function formatAction(action = '') {
  return action.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || '-';
}

function formatEntity(entity = '') {
  return entity.replace(/([a-z])([A-Z])/g, '$1 $2') || '-';
}
