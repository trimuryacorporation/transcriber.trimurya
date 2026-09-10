import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, FileAudio, Folder, Info, ShieldCheck, UploadCloud } from 'lucide-react';
import { api } from '../api/client.js';

export function UploadPage() {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [storage, setStorage] = useState(null);
  const [meta, setMeta] = useState({ language: 'English', priority: 'Normal' });
  const [progress, setProgress] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
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
      setMessage(`${uploaded.length} file(s) uploaded successfully and queued for intake processing.`);
      setSelectedFiles([]);
      formElement.reset();
    } catch (err) {
      setMessage('');
      setError(err.response?.data?.message || err.message || 'Upload failed. Check backend console and R2 credentials.');
    }
  };
  return <div className="space-y-5">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Audio Intake</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Upload Audio Files</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Register new source audio, attach assignment metadata, and place files into the secure transcription workflow.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          <ShieldCheck size={16} />
          Secure private storage
        </div>
      </div>
    </section>

    {storage && <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-md bg-blue-50 text-primary"><Cloud size={22} /></div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Storage Configuration</p>
          <p className="truncate text-lg font-bold text-slate-950">{storage.bucket}</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <StorageInfo label="Audio repository" value={`${storage.audioPrefix}/`} Icon={Folder} />
        <StorageInfo label="Transcript repository" value={`${storage.transcriptPrefix}/`} Icon={Folder} />
        <StorageInfo label="Provider" value="Cloudflare R2 private bucket" Icon={ShieldCheck} />
      </div>
      <details className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Technical endpoint details</summary>
        <p className="mt-2 break-all text-sm font-medium text-slate-600">{storage.s3Api}</p>
      </details>
    </section>}

    <form onSubmit={upload} className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="mb-5 border-b border-slate-200 pb-4">
        <h3 className="font-bold text-slate-950">Intake Details</h3>
        <p className="mt-1 text-sm text-slate-500">Define routing, priority, and review ownership before upload.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div><label>Project</label><select value={meta.project || ''} onChange={(e) => setMeta({ ...meta, project: e.target.value })} required><option value="">Select project</option>{projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
        <div><label>Language</label><input value={meta.language} onChange={(e) => setMeta({ ...meta, language: e.target.value })} /></div>
        <div><label>Priority</label><select value={meta.priority} onChange={(e) => setMeta({ ...meta, priority: e.target.value })}><option>Low</option><option>Normal</option><option>High</option><option>Urgent</option></select></div>
        <div><label>Transcriber</label><select value={meta.assignedTranscriber || ''} onChange={(e) => setMeta({ ...meta, assignedTranscriber: e.target.value })}><option value="">Unassigned at intake</option>{users.filter((u) => u.role === 'transcriber').map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select></div>
        <div><label>Reviewer</label><select value={meta.reviewer || ''} onChange={(e) => setMeta({ ...meta, reviewer: e.target.value })}><option value="">Assign later</option>{users.filter((u) => u.role === 'reviewer').map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select></div>
        <div><label>Deadline</label><input type="date" onChange={(e) => setMeta({ ...meta, deadline: e.target.value })} /></div>
      </div>

      <div className="mt-5">
        <label>Audio files</label>
        <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-primary hover:bg-blue-50">
          <UploadCloud className="text-primary" size={30} />
          <span className="mt-3 text-sm font-bold text-slate-950">Choose audio files for upload</span>
          <span className="mt-1 text-xs text-slate-500">WAV, MP3, M4A, AAC, FLAC, OGG, and common audio formats are supported.</span>
          <input className="sr-only" name="audio" type="file" multiple accept=".wav,.mp3,.m4a,.aac,.flac,.ogg,audio/*" required onChange={(e) => setSelectedFiles([...e.target.files])} />
        </label>
        {selectedFiles.length > 0 && <div className="mt-3 rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">{selectedFiles.length} selected file(s)</div>
          <div className="divide-y divide-slate-100">
            {selectedFiles.map((file) => <div key={file.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700"><FileAudio size={16} className="shrink-0 text-slate-400" /><span className="truncate">{file.name}</span></span>
              <span className="shrink-0 text-xs text-slate-500">{formatBytes(file.size)}</span>
            </div>)}
          </div>
        </div>}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <p className="flex items-center gap-2 text-sm text-slate-500"><Info size={16} /> Uploads are encrypted in transit and queued after completion.</p>
        <button className="btn-primary h-11 px-5"><UploadCloud size={16} /> Submit Audio Intake</button>
      </div>
    </form>

    {Object.entries(progress).map(([name, value]) => <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft" key={name}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate font-medium">{name}</span><span>{value}%</span></div><div className="h-2 rounded bg-slate-200"><div className="h-2 rounded bg-primary" style={{ width: `${value}%` }} /></div></div>)}
    {error && <p className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
    {message && <p className="flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-700"><CheckCircle2 size={16} /> {message}</p>}
  </div>;
}

function StorageInfo({ label, value, Icon }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-2 flex items-center gap-2 font-semibold text-slate-900"><Icon size={16} /> {value}</p>
  </div>;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}
