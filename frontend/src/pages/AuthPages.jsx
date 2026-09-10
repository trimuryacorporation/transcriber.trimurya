import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AudioLines, BadgeCheck, Clock3, LockKeyhole, ShieldCheck } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import loginHero from '../assets/transcription-login-hero.png';

function AuthShell({ children, title }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <img
        src={loginHero}
        alt="Transcription specialist working with audio waveform and transcript panels"
        className="absolute inset-0 h-full w-full object-cover object-[42%_center]"
      />
      <div className="absolute inset-0 bg-slate-950/55" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/58 to-slate-950/18" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/78 via-transparent to-slate-950/25" />

      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl items-center gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[1fr_460px] lg:px-8">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-blue-50 shadow-sm backdrop-blur">
            <ShieldCheck size={16} />
            Enterprise transcription platform
          </div>
          <h2 className="text-3xl font-bold leading-tight sm:text-5xl">
            Govern audio transcription from intake to final review.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-100 sm:text-lg">
            Centralize secure access, assignment queues, transcript production, reviewer decisions, and operational visibility for every file.
          </p>
          <div className="mt-7 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              ['Audio workspace', AudioLines],
              ['Controlled access', LockKeyhole],
              ['Review governance', BadgeCheck]
            ].map(([label, Icon]) => (
              <div key={label} className="rounded-md border border-white/15 bg-white/10 p-4 shadow-sm backdrop-blur">
                <Icon size={19} />
                <p className="mt-3 text-sm font-semibold text-white">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-white/15 bg-slate-950/30 p-4 backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-300">Operational flow</p>
              <p className="mt-2 text-sm font-semibold text-white">Upload, assign, transcribe, review, and approve</p>
            </div>
            <div className="rounded-md border border-white/15 bg-slate-950/30 p-4 backdrop-blur">
              <div className="flex items-center gap-2 text-slate-300">
                <Clock3 size={16} />
                <p className="text-xs font-bold uppercase tracking-wide">Queue visibility</p>
              </div>
              <p className="mt-2 text-sm font-semibold text-white">Monitor workload status and review outcomes</p>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md lg:max-w-none">
          <section className="rounded-lg border border-white/25 bg-white p-6 text-slate-950 shadow-2xl sm:p-8">
            <div className="mb-7 border-b border-slate-200 pb-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-primary text-white shadow-sm">
                  <LockKeyhole size={22} />
                </div>
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
                  Authorized access
                </span>
              </div>
              <h1 className="text-2xl font-bold">Trimurya Transcriber</h1>
              <p className="mt-1 text-sm text-slate-500">{title}</p>
            </div>
            {children}
          </section>
        </div>
      </section>
    </main>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ loginId: '', password: '' });
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await login(form.loginId, form.password);
      navigate(user.role === 'admin' ? '/admin' : user.role === 'tl' ? '/admin/review' : '/transcriber');
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Verify your credentials and try again.');
    }
  };
  return <AuthShell title="Sign in to your secure workspace"><form onSubmit={submit} className="space-y-5"><div><label>User ID</label><input className="mt-1.5" type="text" value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })} required autoComplete="username" /></div><div><label>Password</label><input className="mt-1.5" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="current-password" /></div>{error && <p className="rounded-md border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}<button className="btn-primary h-11 w-full">Sign in</button><Link className="block text-center text-sm font-medium text-primary" to="/forgot-password">Need account access support?</Link></form></AuthShell>;
}

export function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const res = await api.post('/auth/forgot-password', { identifier });
    setMessage(res.data.message);
  };
  return <AuthShell title="Account access recovery"><form onSubmit={submit} className="space-y-5"><div><label>User ID</label><input className="mt-1.5" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required /></div><button className="btn-primary h-11 w-full">Submit recovery request</button>{message && <p className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{message}</p>}<Link className="block text-center text-sm font-medium text-primary" to="/login">Return to sign in</Link></form></AuthShell>;
}
