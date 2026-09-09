import React from 'react';

export function EmptyState({ title = 'Nothing here yet', message = 'Create or adjust filters to see records.' }) {
  return <div className="panel flex min-h-44 items-center justify-center p-8 text-center"><div><p className="font-semibold text-slate-800">{title}</p><p className="mt-1 text-sm text-slate-500">{message}</p></div></div>;
}
