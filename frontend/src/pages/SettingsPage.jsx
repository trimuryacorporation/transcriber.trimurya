import React, { useState } from 'react';
import { Check, LockKeyhole, Power, ShieldCheck, UserCog } from 'lucide-react';
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

  return <div className="max-w-5xl space-y-5">
    <div>
      <h2 className="text-2xl font-bold text-slate-950">Settings</h2>
      <p className="mt-1 text-sm text-slate-500">Manage account security and admin access controls.</p>
    </div>

    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div className="grid h-12 w-12 place-items-center rounded-md bg-primary text-white">
          <UserCog size={22} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-slate-950">{user.name}</p>
          <p className="truncate text-sm text-slate-500">{user.email}</p>
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
            <h3 className="font-bold text-slate-950">Access Controls</h3>
            <p className="text-sm text-slate-500">Permissions available to team leaders.</p>
          </div>
        </div>

        {settings.loading ? <Skeleton lines={3} /> : <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
          <AccessRow
            title="Report Download"
            description="Allow TL users to download reports from the Reports page."
            enabled={Boolean(appSettings.allowTlReportDownload)}
            onChange={(enabled) => updateSetting(
              { allowTlReportDownload: enabled },
              'TL report download enabled.',
              'TL report download disabled.'
            )}
          />
          <AccessRow
            title="Team Creation"
            description="Allow TL users to add transcribers and reviewers."
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
            <h3 className="font-bold text-slate-950">Password</h3>
            <p className="text-sm text-slate-500">Update your login password.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label>Current password</label>
            <input type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          </div>
          <div>
            <label>New password</label>
            <input type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary"><LockKeyhole size={16} /> Update Password</button>
            {message && <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"><Check size={15} /> {message}</span>}
          </div>
        </div>
      </form>
    </div>
  </div>;
}

function AccessRow({ title, description, enabled, onChange }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 p-4">
    <div className="min-w-0">
      <p className="font-semibold text-slate-950">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      className={`inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold text-white shadow-sm transition ${enabled ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
      onClick={() => onChange(!enabled)}
      title={enabled ? 'Enabled' : 'Disabled'}
    >
      <Power size={16} />
      {enabled ? 'ON' : 'OFF'}
    </button>
  </div>;
}
