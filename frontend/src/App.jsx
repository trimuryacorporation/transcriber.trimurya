import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { Layout } from './components/Layout.jsx';
import { Login, ForgotPassword } from './pages/AuthPages.jsx';
import { AdminDashboard } from './pages/AdminDashboard.jsx';
import { ResourcePage } from './pages/ResourcePage.jsx';
import { UploadPage } from './pages/UploadPage.jsx';
import { AssignmentPage } from './pages/AssignmentPage.jsx';
import { ReviewWorkspace } from './pages/ReviewWorkspace.jsx';
import { ReportsPage } from './pages/ReportsPage.jsx';
import { ActivityLogPage } from './pages/ActivityLogPage.jsx';
import { TranscriberDashboard, AssignedWorkPage } from './pages/TranscriberPages.jsx';
import { TranscriptionWorkspace } from './pages/TranscriptionWorkspace.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { ErrorPage } from './pages/ErrorPages.jsx';

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'tl') return <Navigate to="/admin/review" replace />;
  if (user.role === 'reviewer') return <Navigate to="/admin/review" replace />;
  return <Navigate to="/transcriber" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/403" element={<ErrorPage code="403" title="Access denied" />} />
      <Route path="/404" element={<ErrorPage code="404" title="Page not found" />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<Protected roles={['admin']}><AdminDashboard /></Protected>} />
        <Route path="/admin/projects" element={<Protected roles={['admin']}><ResourcePage kind="projects" /></Protected>} />
        <Route path="/admin/upload" element={<Protected roles={['admin']}><UploadPage /></Protected>} />
        <Route path="/admin/assignment" element={<Protected roles={['admin']}><AssignmentPage /></Protected>} />
        <Route path="/admin/files" element={<Protected roles={['admin']}><ResourcePage kind="files" /></Protected>} />
        <Route path="/admin/team" element={<Protected roles={['admin', 'tl']}><ResourcePage kind="team" /></Protected>} />
        <Route path="/admin/transcriber-queue" element={<Protected roles={['tl']}><ReviewWorkspace focus="transcriber" /></Protected>} />
        <Route path="/admin/review" element={<Protected roles={['admin', 'tl', 'reviewer']}><ReviewWorkspace /></Protected>} />
        <Route path="/admin/reports" element={<Protected roles={['admin', 'tl', 'reviewer']}><ReportsPage /></Protected>} />
        <Route path="/admin/activity" element={<Protected roles={['admin']}><ActivityLogPage /></Protected>} />
        <Route path="/transcriber" element={<Protected roles={['transcriber', 'reviewer']}><TranscriberDashboard /></Protected>} />
        <Route path="/transcriber/work" element={<Protected roles={['transcriber', 'reviewer']}><AssignedWorkPage /></Protected>} />
        <Route path="/transcriber/work/:jobId" element={<Protected roles={['transcriber', 'reviewer', 'admin', 'tl']}><TranscriptionWorkspace /></Protected>} />
      </Route>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
