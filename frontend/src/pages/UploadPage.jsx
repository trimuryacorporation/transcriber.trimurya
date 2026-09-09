import React, { useEffect, useState } from 'react';
import { Cloud, Folder, UploadCloud } from 'lucide-react';
import { api } from '../api/client.js';

export function UploadPage() {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [storage, setStorage] = useState(null);
  const [meta, setMeta] = useState({ language: 'English', priority: 'Normal' });
  const [progress, setProgress] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/projects').then((r) => setProjects(r.data.items));
    api.get('/users?limit=100').then((r) => setUsers(r.data.items));
    api.get('/audio/storage-config').then((r) => setStorage(r.data)).catch(() => setStorage(null));
  }, []);
  const upload = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const formElement = e.currentTarget;
    const files = [...formElement.audio.files];
    const formData = new FormData();
    Object.entries(meta).forEach(([key, value]) => {
      if (value) formData.append(key, value);
    });
    files.forEach((file) => {
      formData.append('audio', file);
      formData.append(`duration_${file.name}`, '0');
      setProgress((p) => ({ ...p, [file.name]: 0 }));
    });
    try {
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      const response = await api.post('/audio/uploads/direct', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          const percent = totalBytes ? Math.round((event.loaded / totalBytes) * 100) : 0;
          setProgress(Object.fromEntries(files.map((file) => [file.name, percent])));
        }
      });
      setProgress(Object.fromEntries(files.map((file) => [file.name, 100])));
      const uploaded = response.data.items || [];
      setError('');
      setMessage(`${uploaded.length} file(s) uploaded to Cloudflare R2 bucket ${storage?.bucket || 'configured bucket'} / ${storage?.audioPrefix || 'audio'}/`);
      formElement.reset();
    } catch (err) {
      setMessage('');
      setError(err.response?.data?.message || err.message || 'Upload failed. Check backend console and R2 credentials.');
    }
  };
  return <div className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-bold">Audio Upload</h2><p className="mt-1 text-sm text-slate-500">Files are stored in the private Cloudflare R2 bucket shown below.</p></div></div>{storage && <section className="panel grid gap-3 p-4 md:grid-cols-4"><div className="flex items-center gap-3 md:col-span-2"><div className="grid h-11 w-11 place-items-center rounded-md bg-orange-50 text-orange-600"><Cloud size={22} /></div><div className="min-w-0"><p className="text-xs font-semibold uppercase text-slate-500">Cloudflare R2 Bucket</p><p className="truncate font-bold">{storage.bucket}</p></div></div><div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">Audio folder</p><p className="mt-1 flex items-center gap-2 font-semibold"><Folder size={16} /> {storage.audioPrefix}/</p></div><div className="rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">Transcripts folder</p><p className="mt-1 flex items-center gap-2 font-semibold"><Folder size={16} /> {storage.transcriptPrefix}/</p></div><div className="md:col-span-4 rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">S3 API</p><p className="mt-1 break-all text-sm font-medium">{storage.s3Api}</p></div></section>}<form onSubmit={upload} className="panel grid gap-4 p-5 md:grid-cols-3"><div><label>Project</label><select value={meta.project || ''} onChange={(e) => setMeta({ ...meta, project: e.target.value })} required><option value="">Choose project</option>{projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div><div><label>Language</label><input value={meta.language} onChange={(e) => setMeta({ ...meta, language: e.target.value })} /></div><div><label>Priority</label><select value={meta.priority} onChange={(e) => setMeta({ ...meta, priority: e.target.value })}><option>Low</option><option>Normal</option><option>High</option><option>Urgent</option></select></div><div><label>Transcriber</label><select value={meta.assignedTranscriber || ''} onChange={(e) => setMeta({ ...meta, assignedTranscriber: e.target.value })}><option value="">Unassigned</option>{users.filter((u) => u.role === 'transcriber').map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select></div><div><label>Reviewer</label><select value={meta.reviewer || ''} onChange={(e) => setMeta({ ...meta, reviewer: e.target.value })}><option value="">None</option>{users.filter((u) => u.role === 'reviewer').map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select></div><div><label>Deadline</label><input type="date" onChange={(e) => setMeta({ ...meta, deadline: e.target.value })} /></div><div className="md:col-span-3"><label>Audio files</label><input name="audio" type="file" multiple accept=".wav,.mp3,.m4a,.aac,.flac,.ogg,audio/*" required /></div><button className="btn-accent md:col-span-3"><UploadCloud size={16} /> Upload to Cloudflare R2 audio/</button></form>{Object.entries(progress).map(([name, value]) => <div className="panel p-3" key={name}><div className="mb-1 flex justify-between text-sm"><span>{name}</span><span>{value}%</span></div><div className="h-2 rounded bg-slate-200"><div className="h-2 rounded bg-primary" style={{ width: `${value}%` }} /></div></div>)}{error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}</div>;
}
