import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, BarChart3, Bell, Briefcase, ChevronLeft, ChevronRight, ClipboardCheck, Files, FolderKanban, LogOut, Menu, Search, Settings, Upload, UserCog, UserRound, X } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const adminSections = [
  {
    title: 'Operations',
    links: [
      ['/admin', BarChart3, 'Dashboard'],
      ['/admin/upload', Upload, 'Audio Upload'],
      ['/admin/assignment', ClipboardCheck, 'Assignment'],
      ['/admin/files', Files, 'Audio Files']
    ]
  },
  {
    title: 'Management',
    links: [
      ['/admin/projects', FolderKanban, 'Projects'],
      ['/admin/team', UserCog, 'Team Members'],
      ['/admin/review', ClipboardCheck, 'Review Queue']
    ]
  },
  {
    title: 'Intelligence',
    links: [
      ['/admin/reports', BarChart3, 'Reports'],
      ['/admin/activity', Activity, 'Activity Log']
    ]
  }
];

const workerSections = [
  {
    title: 'Workspace',
    links: [
      ['/transcriber', BarChart3, 'Dashboard'],
      ['/transcriber/work', Briefcase, 'Assigned Work']
    ]
  }
];

const reviewerSections = [
  {
    title: 'Review',
    links: [
      ['/admin/review', ClipboardCheck, 'Review Queue'],
      ['/admin/reports', BarChart3, 'Reports']
    ]
  }
];

const tlSections = [
  {
    title: 'Review',
    links: [
      ['/admin/transcriber-queue', Briefcase, 'Transcriber Queue'],
      ['/admin/review', ClipboardCheck, 'Review Queue'],
      ['/admin/reports', BarChart3, 'Reports']
    ]
  }
];

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [allowTlTeamCreate, setAllowTlTeamCreate] = useState(false);
  const sections = useMemo(() => {
    if (user?.role === 'admin') return adminSections;
    if (user?.role === 'tl') {
      return allowTlTeamCreate
        ? [{ title: 'Management', links: [['/admin/team', UserCog, 'Team Members']] }, ...tlSections]
        : tlSections;
    }
    return user?.role === 'reviewer' ? reviewerSections : workerSections;
  }, [allowTlTeamCreate, user?.role]);
  const pageTitle = useMemo(() => {
    const allLinks = sections.flatMap((section) => section.links);
    return allLinks.find(([path]) => path === location.pathname)?.[2] || 'Workspace';
  }, [sections, location.pathname]);
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  useEffect(() => {
    api.get('/notifications').then((res) => setNotifications(res.data.items || [])).catch(() => setNotifications([]));
  }, []);

  useEffect(() => {
    if (user?.role !== 'tl') {
      setAllowTlTeamCreate(false);
      return;
    }
    api.get('/settings')
      .then((res) => setAllowTlTeamCreate(Boolean(res.data.settings?.allowTlTeamCreate)))
      .catch(() => setAllowTlTeamCreate(false));
  }, [user?.role]);

  useEffect(() => {
    setMobileOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  function submitSearch(e) {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    const encoded = encodeURIComponent(term);
    navigate(user?.role === 'admin' ? `/admin/files?search=${encoded}` : ['tl', 'reviewer'].includes(user?.role) ? `/admin/review?search=${encoded}` : `/transcriber/work?search=${encoded}`);
  }

  async function openNotification(notification) {
    if (!notification.readAt) {
      const { data } = await api.patch(`/notifications/${notification._id}/read`);
      setNotifications((items) => items.map((item) => item._id === notification._id ? data.notification : item));
    }
    if (notification.link) navigate(notification.link);
  }

  async function clearNotifications() {
    try {
      await api.delete('/notifications');
    } catch (err) {
      if (err.response?.status !== 404) throw err;
      await api.post('/notifications/clear');
    }
    setNotifications([]);
    setNotificationsOpen(false);
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {mobileOpen && <button aria-label="Close menu overlay" className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        sections={sections}
        user={user}
        onLogout={async () => { await logout(); navigate('/login'); }}
        onSettings={() => navigate('/settings')}
        onClose={() => setMobileOpen(false)}
        onToggleCollapse={() => setCollapsed((value) => !value)}
      />
      <main className={`min-h-screen transition-all duration-200 ${collapsed ? 'lg:ml-20' : 'lg:ml-72'}`}>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button aria-label="Open menu" className="btn-muted h-10 w-10 p-0 lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={18} /></button>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{user?.role}</p>
                <h1 className="truncate text-lg font-bold text-slate-950 sm:text-xl">{pageTitle}</h1>
              </div>
            </div>
            <form onSubmit={submitSearch} className="hidden w-full max-w-md items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
              <Search size={17} className="text-slate-400" />
              <input className="border-0 bg-transparent p-0 focus:ring-0" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files, projects, users" />
            </form>
            <div className="flex shrink-0 items-center gap-2">
              <div className="relative">
                <button className="btn-muted relative h-10 w-10 p-0" title="Notifications" onClick={() => setNotificationsOpen((value) => !value)}>
                  <Bell size={17} />
                  {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-slate-950">{unreadCount}</span>}
                </button>
                {notificationsOpen && <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">Notifications</p>
                        <p className="text-xs text-slate-500">{unreadCount} unread</p>
                      </div>
                      {notifications.length > 0 && <button className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50" onClick={clearNotifications}>Clear All</button>}
                    </div>
                  </div>
                  {!notifications.length ? <p className="p-4 text-sm text-slate-500">No notifications.</p> : <div className="max-h-96 overflow-auto">
                    {notifications.map((notification) => <button key={notification._id} className={`block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${notification.readAt ? 'bg-white' : 'bg-blue-50'}`} onClick={() => openNotification(notification)}>
                      <p className="font-semibold text-slate-900">{notification.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
                      <p className="mt-2 text-xs text-slate-400">{new Date(notification.createdAt).toLocaleString()}</p>
                    </button>)}
                  </div>}
                </div>}
              </div>
              <button className="btn-muted hidden sm:inline-flex" onClick={() => navigate('/settings')}><Settings size={16} /> Settings</button>
              <button className="btn-muted hidden md:inline-flex" onClick={async () => { await logout(); navigate('/login'); }}><LogOut size={16} /> Logout</button>
            </div>
          </div>
        </header>
        <div className="px-4 py-5 sm:px-5 lg:px-6"><Outlet /></div>
      </main>
    </div>
  );
}

function Sidebar({ collapsed, mobileOpen, sections, user, onLogout, onSettings, onClose, onToggleCollapse }) {
  return (
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-primary text-white shadow-2xl transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-20' : 'lg:w-72'}`}>
      <div className="flex min-h-16 items-center justify-between border-b border-white/10 px-4">
        <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
          <p className="truncate text-lg font-bold">Trimurya</p>
          <p className="truncate text-xs text-blue-100">Enterprise Transcription</p>
        </div>
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white text-primary ${collapsed ? 'lg:flex' : 'hidden'}`}>T</div>
        <button aria-label="Close menu" className="rounded-md p-2 hover:bg-white/10 lg:hidden" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15"><UserRound size={18} /></div>
          <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="truncate text-xs text-blue-100">{user?.loginId} · {user?.role}</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div className="mb-5" key={section.title}>
            <p className={`mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-blue-200 ${collapsed ? 'lg:hidden' : ''}`}>{section.title}</p>
            <div className="grid gap-1">
              {section.links.map(([to, Icon, label]) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  title={label}
                  className={({ isActive }) => `flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition ${isActive ? 'bg-white text-primary shadow-sm' : 'text-blue-50 hover:bg-white/10'} ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-2 border-t border-white/10 p-3">
        <button className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-blue-50 hover:bg-white/10 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`} onClick={onSettings} title="Settings">
          <Settings size={18} />
          <span className={`${collapsed ? 'lg:hidden' : ''}`}>Settings</span>
        </button>
        <button className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-blue-50 hover:bg-white/10 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`} onClick={onLogout} title="Logout">
          <LogOut size={18} />
          <span className={`${collapsed ? 'lg:hidden' : ''}`}>Logout</span>
        </button>
        <button className="hidden h-10 w-full items-center justify-center gap-2 rounded-md text-sm font-semibold text-blue-50 hover:bg-white/10 lg:flex" onClick={onToggleCollapse}>
          {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span>Collapse menu</span></>}
        </button>
      </div>
    </aside>
  );
}
