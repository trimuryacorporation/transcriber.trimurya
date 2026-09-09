import React from 'react';

const colors = {
  Unassigned: 'bg-slate-100 text-slate-700',
  Assigned: 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-indigo-100 text-indigo-800',
  'Draft Saved': 'bg-yellow-100 text-yellow-900',
  Submitted: 'bg-purple-100 text-purple-800',
  'Under Review': 'bg-cyan-100 text-cyan-800',
  'Returned for Correction': 'bg-orange-100 text-orange-900',
  Resubmitted: 'bg-violet-100 text-violet-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  Rejected: 'bg-red-100 text-red-800',
  'On Hold': 'bg-stone-100 text-stone-800',
  Archived: 'bg-slate-200 text-slate-600'
};

export function StatusBadge({ status }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${colors[status] || colors.Unassigned}`}>{status}</span>;
}
