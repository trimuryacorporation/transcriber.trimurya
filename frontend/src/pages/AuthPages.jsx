import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

function AuthShell({ children, title }) {
  return <main className="grid min-h-screen place-items-center bg-slate-100 px-4"><section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-soft"><div className="mb-6 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-md bg-primary text-white"><LockKeyhole /></div><div><h1 className="text-xl font-bold">Trimurya Transcriber</h1><p className="text-sm text-slate-500">{title}</p></div></div>{children}</section></main>;
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
