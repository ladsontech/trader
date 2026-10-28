import { NavLink, Outlet } from 'react-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../lib/auth-context';
import { StatusDot, cx } from '../ui';
import {
  BarChart3,
  Bot,
  Check,
  LayoutDashboard,
  LogOut,
  Plug,
  Settings as SettingsIcon,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

/** Account → Plan → Broker → Trade, shown until setup is finished. */
function SetupSteps({ step }: { step: 2 | 3 }) {
  const steps = ['Account', 'Plan', 'Broker', 'Trade'];
  return (
    <ol className="flex items-center gap-1.5 sm:gap-2" aria-label="Setup progress">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex items-center gap-1.5 sm:gap-2">
            <span
              aria-current={current ? 'step' : undefined}
              className={cx(
                'flex items-center gap-1.5 h-7 rounded-full px-2.5 text-[12px] font-semibold border',
                current && 'bg-accent text-[#06231b] border-accent',
                done && 'border-accent/30 text-accent bg-accent-soft',
                !current && !done && 'border-line text-ink-faint'
              )}
            >
              {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <span className="tnum">{n}</span>}
              <span className={cx(!current && 'hidden sm:inline')}>{label}</span>
            </span>
            {n < steps.length && <span className="w-3 sm:w-5 h-px bg-line-strong" />}
          </li>
        );
      })}
    </ol>
  );
}

export default function AppLayout() {
  const { userData, isSubscribed, isBrokerConnected, isAdmin } = useAuth();

  // Until the user has paid and connected a broker, show only the next step:
  // no menu, no dashboard tabs that would just bounce them back.
  if (!isAdmin && (!isSubscribed || !isBrokerConnected)) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-xl">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
            <div className="w-8 h-8 shrink-0 rounded-[9px] bg-accent-soft border border-accent/25 flex items-center justify-center">
              <Bot className="w-4 h-4 text-accent" />
            </div>
            <SetupSteps step={isSubscribed ? 3 : 2} />
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="w-8 h-8 shrink-0 flex items-center justify-center rounded-[9px] text-ink-faint hover:text-ink hover:bg-surface cursor-pointer"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <Outlet />
        </main>
      </div>
    );
  }

  const NAV = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/trades', label: 'Trades', icon: BarChart3 },
    { to: '/broker', label: 'Broker', icon: Plug },
    { to: '/subscribe', label: 'Plan', icon: Wallet },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: ShieldCheck, end: false }] : []),
  ];

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
            {isAdmin && (
              <span className="chip text-[11px] font-bold text-accent border-accent/30 bg-accent-soft">
                Admin
              </span>
            )}
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
