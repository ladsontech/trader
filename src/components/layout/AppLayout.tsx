import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../../lib/auth-context';
import { StatusDot, cx } from '../ui';
import {
  BarChart3,
  Bot,
  LayoutDashboard,
  Plug,
  Settings as SettingsIcon,
  Wallet,
} from 'lucide-react';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/trades', label: 'Trades', icon: BarChart3 },
  { to: '/broker', label: 'Broker', icon: Plug },
  { to: '/subscribe', label: 'Plan', icon: Wallet },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function AppLayout() {
  const { userData, isSubscribed, isBrokerConnected } = useAuth();

  const status: { tone: 'up' | 'warn' | 'idle'; label: string } = !isSubscribed
    ? { tone: 'idle', label: 'No plan' }
    : !isBrokerConnected
      ? { tone: 'warn', label: 'No broker' }
      : userData?.botEnabled
        ? { tone: 'up', label: 'Live' }
        : { tone: 'warn', label: 'Paused' };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 h-14 border-b border-line bg-canvas/85 backdrop-blur-xl">
        <div className="h-full max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[9px] bg-accent-soft border border-accent/25 flex items-center justify-center">
              <Bot className="w-4 h-4 text-accent" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">TradeBot</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="chip">
              <StatusDot tone={status.tone} />
              {status.label}
            </span>
            {userData?.phoneDigits && (
              <span className="chip tnum hidden sm:inline-flex">{userData.phoneDigits}</span>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-5xl mx-auto flex">
        {/* Desktop nav */}
        <nav className="hidden md:block w-52 shrink-0 border-r border-line py-6 px-3">
          <ul className="space-y-0.5 sticky top-20">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-2.5 px-3 py-2 rounded-[9px] text-[13.5px] font-medium transition-colors',
                      isActive
                        ? 'bg-surface-2 text-ink'
                        : 'text-ink-soft hover:text-ink hover:bg-surface/70'
                    )
                  }
                >
                  <Icon className="w-[17px] h-[17px]" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 pb-24 md:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-canvas/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <ul className="flex">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx(
                    'flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition-colors',
                    isActive ? 'text-accent' : 'text-ink-faint'
                  )
                }
              >
                <Icon className="w-[18px] h-[18px]" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
