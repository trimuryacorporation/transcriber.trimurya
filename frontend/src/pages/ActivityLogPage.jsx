import React from 'react';
import { useFetch } from '../hooks/useFetch.js';
import { Skeleton } from '../components/Skeleton.jsx';

export function ActivityLogPage() {
  const { data, loading } = useFetch('/activity?limit=100', []);
  if (loading) return <Skeleton />;
  return <div className="space-y-4"><h2 className="text-2xl font-bold">Activity Log</h2><div className="panel overflow-x-auto"><table className="w-full"><thead><tr><th className="table-th">Time</th><th className="table-th">Actor</th><th className="table-th">Action</th><th className="table-th">Entity</th></tr></thead><tbody>{data.items.map((a) => <tr key={a._id} className="border-t"><td className="table-td">{new Date(a.createdAt).toLocaleString()}</td><td className="table-td">{a.actor?.name || 'System'}</td><td className="table-td">{a.action}</td><td className="table-td">{a.entityType}</td></tr>)}</tbody></table></div></div>;
}
