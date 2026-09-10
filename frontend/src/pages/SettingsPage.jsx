import React, { useState } from 'react';
import { Check, KeyRound, LockKeyhole, Power, ShieldCheck, UserCog } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch } from '../hooks/useFetch.js';
import { Skeleton } from '../components/Skeleton.jsx';

export function SettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');
  const [accessMessage, setAccessMessage] = useState('');
  const settings = useFetch(user?.role === 'admin' ? '/settings' : null, [user?.role]);
  const appSettings = settings.data?.settings || {};

  const submit = async (e) => {
    e.preventDefault();
    await api.patch('/auth/password', form);
    setMessage('Password updated.');
    setForm({ currentPassword: '', newPassword: '' });
  };

  const updateSetting = async (payload, enabledMessage, disabledMessage) => {
    setAccessMessage('');
    const res = await api.patch('/settings', payload);
    await settings.reload();
    const enabled = Boolean(res.data.settings[Object.keys(payload)[0]]);
    setAccessMessage(enabled ? enabledMessage : disabledMessage);
  };

  return <div className="max-w-6xl space-y-5">
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Security Administration</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Workspace Settings</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Manage account credentials, team-leader permissions, and administrative controls that affect access across production workflows.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-primary">
          <ShieldCheck size={16} />
          Controlled workspace
        </div>
      </div>
    </section>

    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div className="grid h-12 w-12 place-items-center rounded-md bg-primary text-white">
          <UserCog size={22} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Signed-in Account</p>
          <p className="truncate text-base font-bold text-slate-950">{user.name}</p>
          <p className="truncate text-sm text-slate-500">{user.email} · Login ID {user.loginId}</p>
        </div>
        <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-600">{user.role}</span>
      </div>
    </section>

    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      {user?.role === 'admin' && <section className="panel p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-50 text-emerald-700">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-950">Administrative Access Policies</h3>
            <p className="text-sm text-slate-500">Govern team-leader capabilities for reporting and workforce administration.</p>
          </div>
        </div>

        {settings.loading ? <Skeleton lines={3} /> : <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
          <AccessRow
            title="Report Download"
            description="Permit team leaders to export operational reports from the reporting workspace."
            impact="Recommended only for TL users responsible for delivery reporting or client-facing operations."
            enabled={Boolean(appSettings.allowTlReportDownload)}
            onChange={(enabled) => updateSetting(
              { allowTlReportDownload: enabled },
              'TL report download enabled.',
              'TL report download disabled.'
            )}
          />
          <AccessRow
            title="Team Creation"
            description="Permit team leaders to provision transcriber and reviewer access records."
            impact="Use when TL users are accountable for staffing and reviewer allocation within their queue."
            enabled={Boolean(appSettings.allowTlTeamCreate)}
            onChange={(enabled) => updateSetting(
              { allowTlTeamCreate: enabled },
              'TL team creation enabled.',
              'TL team creation disabled.'
            )}
          />
        </div>}
        {accessMessage && <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{accessMessage}</p>}
      </section>}

      <form onSubmit={submit} className="panel p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-primary">
            <LockKeyhole size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-950">Credential Security</h3>
            <p className="text-sm text-slate-500">Update the password used to access this workspace.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label>Current password</label>
            <input className="mt-1.5" type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          </div>
          <div>
            <label>New password</label>
            <input className="mt-1.5" type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          </div>
          <p className="flex gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"><KeyRound size={16} className="mt-0.5 shrink-0 text-slate-400" /> Use a strong password that is not shared with any other system.</p>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary"><LockKeyhole size={16} /> Update Password</button>
            {message && <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"><Check size={15} /> {message}</span>}
          </div>
        </div>
      </form>
    </div>
  </div>;
}

function AccessRow({ title, description, impact, enabled, onChange }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 p-4">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-slate-950">{title}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{enabled ? 'Enabled' : 'Disabled'}</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      {impact && <p className="mt-2 text-xs font-medium text-slate-500">{impact}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      className={`inline-flex h-10 min-w-32 items-center justify-center gap-2 rounded-md border px-4 text-sm font-bold shadow-sm transition ${enabled ? 'border-emerald-200 bg-emerald-600 text-white hover:bg-emerald-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
      onClick={() => onChange(!enabled)}
      title={enabled ? 'Enabled' : 'Disabled'}
    >
      <Power size={16} />
      {enabled ? 'Disable' : 'Enable'}
    </button>
  </div>;
}
