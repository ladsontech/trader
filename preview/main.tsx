import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router';
import './preview.css';
import AppLayout from '../src/components/layout/AppLayout';
import AuthPage from '../src/pages/AuthPage';
import Onboarding from '../src/pages/Onboarding';
import Subscribe from '../src/pages/Subscribe';
import ConnectBroker from '../src/pages/ConnectBroker';
import Dashboard from '../src/pages/Dashboard';
import Trades from '../src/pages/Trades';
import Settings from '../src/pages/Settings';

const screen = new URLSearchParams(location.search).get('screen') || 'dashboard';

const chromeless: Record<string, React.ReactNode> = {
  auth: <AuthPage />,
  onboarding: <Onboarding />,
};

const inApp: Record<string, { path: string; el: React.ReactNode }> = {
  dashboard: { path: '/', el: <Dashboard /> },
  trades: { path: '/trades', el: <Trades /> },
  broker: { path: '/broker', el: <ConnectBroker /> },
  subscribe: { path: '/subscribe', el: <Subscribe /> },
  settings: { path: '/settings', el: <Settings /> },
};

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    {chromeless[screen] ? (
      <MemoryRouter>{chromeless[screen]}</MemoryRouter>
    ) : (
      <MemoryRouter initialEntries={[inApp[screen].path]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path={inApp[screen].path} element={inApp[screen].el} />
          </Route>
        </Routes>
      </MemoryRouter>
    )}
  </StrictMode>
);
