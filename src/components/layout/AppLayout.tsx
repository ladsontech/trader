import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../lib/auth-context';
import {
  LayoutDashboard,
  Bot,
  BarChart3,
  Wifi,
  Settings,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/subscribe', icon: <Bot className="w-5 h-5" />, label: 'Subscribe' },
  { to: '/trades', icon: <BarChart3 className="w-5 h-5" />, label: 'Trades' },
  { to: '/broker', icon: <Wifi className="w-5 h-5" />, label: 'Broker' },
  { to: '/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
];

export default function AppLayout() {
  const { userData } = useAuth();
  const location = useLocation();

  const isSubscribed = userData?.subscriptionStatus === 'active';

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-[var(--bg-secondary)]/80 backdrop-blur-xl border-r border-[var(--border-subtle)] z-40">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-[var(--border-subtle)]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-blue)] to-[#2563EB] flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight">TradeBot</h1>
            <p className="text-[9px] text-[var(--text-muted)] font-semibold uppercase tracking-wider">
              {isSubscribed ? 'Active' : 'Inactive'}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-5 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Subscription Status */}
        <div className="px-4 pb-6">
          <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 mb-2">
              {isSubscribed ? (
                <div className="badge-active">Active</div>
              ) : (
                <div className="badge-inactive">Inactive</div>
              )}
            </div>
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
              {isSubscribed
                ? `${userData?.subscriptionPlan === 'premium' ? 'Premium' : 'Standard'} plan active.`
                : 'Subscribe to activate the bot.'}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pb-24 lg:pb-8">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between px-5 py-4 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)] sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-blue)] to-[#2563EB] flex items-center justify-center shadow-md shadow-blue-500/20">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-black tracking-tight">TradeBot</span>
          </div>
          {isSubscribed ? (
            <div className="badge-active">Active</div>
          ) : (
            <div className="badge-inactive">Inactive</div>
          )}
        </div>

        <div className="p-5 sm:p-6 lg:p-8 max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="bottom-nav lg:hidden">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const isActive =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={`bottom-nav-item ${isActive ? 'active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
