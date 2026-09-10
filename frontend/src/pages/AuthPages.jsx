import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AudioLines, BadgeCheck, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
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
      <div className="absolute inset-0 bg-slate-950/45" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/48 to-slate-950/28" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-slate-950/15" />

      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-7xl items-center gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[1fr_480px] lg:px-8">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/15 px-3 py-2 text-sm font-semibold shadow-sm backdrop-blur">
            <AudioLines size={18} />
            Secure transcription workspace
          </div>
          <h2 className="text-3xl font-bold leading-tight sm:text-5xl">
            Turn audio into reviewed, organized transcripts.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-blue-50 sm:text-lg">
            A focused workspace for transcription teams to manage audio, write clean text, review comments, and move files through approval.
          </p>
          <div className="mt-6 grid max-w-2xl gap-3 sm:mt-8 sm:grid-cols-3">
            {[
              ['Audio sync', AudioLines],
              ['Protected login', ShieldCheck],
              ['Review flow', BadgeCheck]
            ].map(([label, Icon]) => (
              <div key={label} className="rounded-md border border-white/15 bg-white/15 p-4 shadow-sm backdrop-blur">
                <Icon size={20} />
                <p className="mt-3 text-sm font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto w-full max-w-md lg:max-w-none">
          <section className="rounded-lg border border-white/20 bg-white/95 p-6 text-slate-950 shadow-2xl backdrop-blur sm:p-8">
            <div className="mb-7 flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-primary text-white shadow-sm">
                <LockKeyhole size={24} />
              </div>
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-yellow-50 px-2 py-1 text-xs font-bold uppercase text-amber-700">
                  <Sparkles size={13} />
                  Workspace
                </div>
                <h1 className="text-2xl font-bold">Trimurya Transcriber</h1>
                <p className="mt-1 text-sm text-slate-500">{title}</p>
              </div>
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
      setError(err.response?.data?.message || 'Unable to sign in');
    }
  };
  return <AuthShell title="Secure sign in"><form onSubmit={submit} className="space-y-4"><div><label>Login ID</label><input type="text" value={form.loginId} onChange={(e) => setForm({ ...form, loginId: e.target.value })} required autoComplete="username" /></div><div><label>Password</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="current-password" /></div>{error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button className="btn-primary w-full">Log in</button><Link className="block text-center text-sm text-primary" to="/forgot-password">Forgot password?</Link></form></AuthShell>;
}

export function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    const res = await api.post('/auth/forgot-password', { identifier });
    setMessage(res.data.message);
  };
  return <AuthShell title="Password recovery"><form onSubmit={submit} className="space-y-4"><div><label>Login ID</label><input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required /></div><button className="btn-primary w-full">Request reset help</button>{message && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}<Link className="block text-center text-sm text-primary" to="/login">Back to login</Link></form></AuthShell>;
}
