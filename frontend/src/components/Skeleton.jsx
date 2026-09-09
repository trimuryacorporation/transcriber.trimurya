import React from 'react';

export function Skeleton({ lines = 4 }) {
  return <div className="space-y-3">{Array.from({ length: lines }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-md bg-slate-200" />)}</div>;
}
