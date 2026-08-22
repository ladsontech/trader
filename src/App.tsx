import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import React from 'react';
import { AuthProvider, useAuth } from './lib/auth-context';
import AppLayout from './components/layout/AppLayout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Subscribe from './pages/Subscribe';
import ConnectBroker from './pages/ConnectBroker';
import Trades from './pages/Trades';
import Settings from './pages/Settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-mesh">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-3 border-[var(--accent-blue)]/20 border-t-[var(--accent-blue)] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[var(--text-muted)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/auth"
        element={user ? <Navigate to="/" replace /> : <AuthPage />}
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/broker" element={<ConnectBroker />} />
        <Route path="/trades" element={<Trades />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
