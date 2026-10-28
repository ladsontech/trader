import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import type React from 'react';
import { AuthProvider, useAuth } from './lib/auth-context';
import AppLayout from './components/layout/AppLayout';
import AuthPage from './pages/AuthPage';
import Subscribe from './pages/Subscribe';
import ConnectBroker from './pages/ConnectBroker';
import Dashboard from './pages/Dashboard';
import Trades from './pages/Trades';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
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
 * Signed out            → /auth        (step 1: create account)
 * Signed in, unpaid     → /subscribe   (step 2: choose a plan and pay)
 * Paid, no broker       → /broker      (step 3: connect broker)
 * Everything else       → the app      (step 4: trade)
 *
 * This is routing convenience, not the security boundary. The real
 * enforcement is server-side: the Cloud Functions refuse to connect a
 * broker or run the bot without an active subscription, and only the
 * payment webhook can mark one active.
 */
function Gate({ children }: { children: React.ReactNode }) {
  const {
    user,
    loading,
    profileLoaded,
    isSubscribed,
    isBrokerConnected,
    isAdmin,
  } = useAuth();
  const location = useLocation();

  if (loading) return <Booting />;
  if (!user) return <Navigate to="/auth" replace />;

  // Never route on a profile we have not actually read. Without this, a slow
  // or failed read looks identical to "this user has not paid", and a paying
  // customer gets thrown back to the paywall mid-session.
  if (!profileLoaded) return <Booting />;

  // Admin has complete access to everything without gating
  if (isAdmin) return <>{children}</>;

  const path = location.pathname;

  // Settings is always reachable (sign out, etc.)
  if (path === '/settings') {
    return <>{children}</>;
  }

  if (!isSubscribed && path !== '/subscribe') {
    return <Navigate to="/subscribe" replace />;
  }

  // /subscribe stays open so a fresh payer sees "Payment received" before
  // moving on (and so subscribers can renew).
  if (isSubscribed && !isBrokerConnected && path !== '/broker' && path !== '/subscribe') {
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

      {/* Old links */}
      <Route path="/welcome" element={<Navigate to="/" replace />} />
      <Route path="/trade-admin" element={<Navigate to="/admin" replace />} />

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
        <Route path="/admin" element={<Admin />} />
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
