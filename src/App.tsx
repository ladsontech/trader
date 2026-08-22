import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import type React from 'react';
import { AuthProvider, useAuth } from './lib/auth-context';
import AppLayout from './components/layout/AppLayout';
import AuthPage from './pages/AuthPage';
import Onboarding from './pages/Onboarding';
import Subscribe from './pages/Subscribe';
import ConnectBroker from './pages/ConnectBroker';
import Dashboard from './pages/Dashboard';
import Trades from './pages/Trades';
import Settings from './pages/Settings';
import { Spinner } from './components/ui';

function Booting() {
  return (
    <div className="min-h-screen grid-backdrop flex items-center justify-center">
      <Spinner label="Loading your account" />
    </div>
  );
}

/**
 * The paywall.
 *
 * Signed out            → /auth
 * Signed in, no cards   → /welcome
 * Signed in, unpaid     → /subscribe
 * Paid, no broker       → /broker
 * Everything else       → the app
 *
 * This is routing convenience, not the security boundary. The real
 * enforcement is server-side: the Cloud Functions refuse to connect a
 * broker or run the bot without an active subscription, and only the
 * payment webhook can mark one active.
 */
function Gate({ children }: { children: React.ReactNode }) {
  const { user, loading, isSubscribed, isBrokerConnected, hasSeenOnboarding } = useAuth();
  const location = useLocation();

  if (loading) return <Booting />;
  if (!user) return <Navigate to="/auth" replace />;

  const path = location.pathname;

  if (!hasSeenOnboarding && path !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }

  if (hasSeenOnboarding && !isSubscribed && path !== '/subscribe') {
    return <Navigate to="/subscribe" replace />;
  }

  if (isSubscribed && !isBrokerConnected && path !== '/broker' && path !== '/settings') {
    return <Navigate to="/broker" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <Booting />;

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />

      {/* Full-bleed screens: no app chrome until the user is inside. */}
      <Route
        path="/welcome"
        element={
          <Gate>
            <Onboarding />
          </Gate>
        }
      />

      <Route
        element={
          <Gate>
            <AppLayout />
          </Gate>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/broker" element={<ConnectBroker />} />
        <Route path="/trades" element={<Trades />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
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
