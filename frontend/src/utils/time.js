export function formatSeconds(value = 0) {
  const ms = Math.floor((value % 1) * 1000).toString().padStart(3, '0');
  const total = Math.floor(value);
  const h = Math.floor(total / 3600).toString().padStart(2, '0');
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(total % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}.${ms}`;
}

export function parseStamp(stamp) {
  const [h = '0', m = '0', rest = '0'] = String(stamp).split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(rest);
}
