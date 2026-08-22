import { NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../lib/auth-context';
import {
  LayoutDashboard,
  Zap,
  BarChart3,
  Plug,
  Settings,
  Bot,
  LogOut
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';

const navItems = [
  { to: '/', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/subscribe', icon: <Zap className="w-5 h-5" />, label: 'Packages' },
  { to: '/broker', icon: <Plug className="w-5 h-5" />, label: 'Brokers' },
  { to: '/trades', icon: <BarChart3 className="w-5 h-5" />, label: 'Live Trades' },
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
    <div className="min-h-screen bg-radial-grid flex flex-col text-slate-100 selection:bg-emerald-500/20 selection:text-emerald-400">
      
      {/* Top Banner (Desktop & Mobile) */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 p-0.5 shadow-lg shadow-emerald-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Bot className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-white text-base sm:text-lg tracking-tight">TradeBot</span>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Automated Forex Execution &bull; Investio Gateway</p>
          </div>
        </div>

        {/* Header Right Stats Pill */}
        <div className="flex items-center gap-2.5">
          {/* Bot Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-white/10 text-xs">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isBrokerConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isBrokerConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-[11px] font-extrabold text-slate-300 hidden sm:inline">
              {isBrokerConnected ? `${userData?.broker} Active` : isSubscribed ? 'Connect Broker' : 'Subscribe to Trade'}
            </span>
            <span className="text-[11px] font-extrabold text-slate-300 sm:hidden">
              {isBrokerConnected ? 'Live' : 'Standby'}
            </span>
          </div>

          {/* User Profile Pill */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-white/10 text-xs font-mono font-bold text-slate-300">
            <span className="text-emerald-400">🇺🇬</span>
            <span>{phoneDisplay}</span>
          </div>
        </div>
      </header>

      {/* App Body with Sidebar on Desktop */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 p-5 space-y-6 border-r border-white/5 shrink-0">
          <div className="space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-3 mb-2">
              Main Terminal
            </div>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/5'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>

          {/* Subscription Status Card */}
          <div className="mt-auto glass-panel p-4 rounded-2xl border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-slate-300">Package Status</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                isSubscribed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {isSubscribed ? userData?.subscriptionPlan || 'Active' : 'Unsubscribed'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {isSubscribed
                ? 'Your AI Bot is executing trades directly on your connected broker.'
                : 'Choose a 50k or 100k package to activate automated trading.'}
            </p>
            <NavLink
              to="/subscribe"
              className="block text-center py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-all"
            >
              {isSubscribed ? 'Manage Package' : 'Activate Bot'}
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

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-28 lg:pb-12 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Floating Bottom Nav for Mobile */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-50 glass-panel p-1.5 rounded-2xl border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
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
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                  isActive
                    ? 'bg-gradient-to-tr from-emerald-500/25 to-teal-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="mb-0.5">{item.icon}</div>
                <span className="text-[10px] font-extrabold tracking-tight">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
