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
  const {
    user,
    loading,
    profileLoaded,
    isSubscribed,
    isBrokerConnected,
    hasSeenOnboarding,
  } = useAuth();
  const location = useLocation();

  if (loading) return <Booting />;
  if (!user) return <Navigate to="/auth" replace />;

  // Never route on a profile we have not actually read. Without this, a slow
  // or failed read looks identical to "this user has not paid", and a paying
  // customer gets thrown back to the paywall mid-session.
  if (!profileLoaded) return <Booting />;

  const path = location.pathname;

  if (!hasSeenOnboarding && path !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }

  // Settings is always reachable — it is where the sign-out button lives, and
  // trapping someone in a redirect loop with no way out is worse than showing
  // them a page with a locked panel on it.
  if (path === '/settings') return <>{children}</>;

  if (hasSeenOnboarding && !isSubscribed && path !== '/subscribe') {
    return <Navigate to="/subscribe" replace />;
  }

  if (isSubscribed && !isBrokerConnected && path !== '/broker') {
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
