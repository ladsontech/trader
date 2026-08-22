import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../lib/auth-context';
import {
  LayoutDashboard,
  Zap,
  BarChart3,
  Plug,
  Settings,
  Bot,
  LogOut,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';

const navItems = [
  { to: '/', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/subscribe', icon: <Zap className="w-5 h-5" />, label: 'Packages' },
  { to: '/broker', icon: <Plug className="w-5 h-5" />, label: 'Brokers' },
  { to: '/trades', icon: <BarChart3 className="w-5 h-5" />, label: 'Trades' },
  { to: '/settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
];

export default function AppLayout() {
  const { userData, user } = useAuth();
  const location = useLocation();

  const isSubscribed = userData?.subscriptionStatus === 'active';
  const isBrokerConnected = userData?.brokerConnected === true;
  const phoneDisplay = userData?.phoneDigits || user?.email?.split('@')[0] || 'Trader';

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div className="min-h-screen bg-[#080C14] text-slate-100 flex flex-col antialiased selection:bg-emerald-500/20 selection:text-emerald-400">
      
      {/* ── TOP APP BAR (Fixed with safe height) ── */}
      <header className="sticky top-0 z-40 bg-[#0B111E]/90 backdrop-blur-xl border-b border-white/[0.08] h-16 px-4 sm:px-6 flex items-center justify-between shadow-sm">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 p-0.5 shadow-md shadow-emerald-500/20">
            <div className="w-full h-full bg-[#080C14] rounded-[10px] flex items-center justify-center">
              <Bot className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-white text-base tracking-tight">TradeBot</span>
              <span className="px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                AI
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Automated Forex Trading &bull; Investio</p>
          </div>
        </div>

        {/* Top Right Status Badges */}
        <div className="flex items-center gap-2">
          {/* Live Status Pill */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${
            isBrokerConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : isSubscribed
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isBrokerConnected ? 'bg-emerald-400' : isSubscribed ? 'bg-cyan-400' : 'bg-rose-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isBrokerConnected ? 'bg-emerald-500' : isSubscribed ? 'bg-cyan-500' : 'bg-rose-500'
              }`}></span>
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-wide">
              {isBrokerConnected ? `${userData?.broker} Active` : isSubscribed ? 'Broker Standby' : 'Inactive'}
            </span>
          </div>

          {/* User Phone Pill (Desktop) */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-white/10 text-xs font-mono font-bold text-slate-300">
            <span>🇺🇬</span>
            <span>{phoneDisplay}</span>
          </div>
        </div>
      </header>

      {/* ── APP BODY ── */}
      <div className="flex-1 flex max-w-6xl w-full mx-auto">
        
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 p-5 space-y-6 border-r border-white/[0.08] shrink-0">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-3 mb-2">
              Navigation
            </div>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/30 shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          {/* Subscription Status Widget */}
          <div className="mt-auto p-4 rounded-2xl bg-[#0F172A] border border-white/[0.08] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-slate-300">Plan Status</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                isSubscribed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {isSubscribed ? userData?.subscriptionPlan || 'Active' : 'No Plan'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {isSubscribed
                ? 'Your bot is active and executing trades via Investio.'
                : 'Deposit UGX 50k or 100k to activate automated trading.'}
            </p>
            <NavLink
              to="/subscribe"
              className="block text-center py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-all"
            >
              {isSubscribed ? 'Manage Plan' : 'Subscribe Now'}
            </NavLink>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-colors w-full cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </aside>

        {/* ── MAIN CONTENT CONTAINER (Generous padding, never clipped) ── */}
        <main className="flex-1 w-full p-4 sm:p-6 lg:p-8 pt-6 sm:pt-8 pb-32 lg:pb-12 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* ── DOCKED MOBILE BOTTOM NAVIGATION (Never overlaps) ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0B111E]/95 backdrop-blur-2xl border-t border-white/[0.08] px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="grid grid-cols-5 gap-1">
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
                className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                <div className="mb-0.5">{item.icon}</div>
                <span className="text-[10px] tracking-tight">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
