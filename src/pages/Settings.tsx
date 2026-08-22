import { useAuth } from '../lib/auth-context';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  User,
  Plug,
  LogOut,
  Calendar,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router';

export default function Settings() {
  const { userData, user } = useAuth();

  const isSubscribed = userData?.subscriptionStatus === 'active';
  const isBrokerConnected = userData?.brokerConnected === true;

  const handleLogout = () => {
    signOut(auth);
  };

  const phoneDisplay = userData?.phoneDigits || user?.email?.split('@')[0] || 'Trader';
  const planName = userData?.subscriptionPlan === 'premium' ? 'VIP Premium Plan' : userData?.subscriptionPlan === 'standard' ? 'Standard Plan' : 'No Active Plan';

  const expiresAt = userData?.subscriptionExpiresAt
    ? new Date(userData.subscriptionExpiresAt).toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'N/A';

  return (
    <div className="max-w-xl mx-auto space-y-6 sm:space-y-8 animate-slide-in">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Account Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Manage your subscription, broker connections, and profile.
        </p>
      </div>

      {/* User Profile Card */}
      <div className="glass-panel p-6 rounded-3xl border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-400 to-cyan-400 p-0.5 shadow-lg shadow-emerald-500/10">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
              <User className="w-6 h-6" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-black text-white">🇺🇬 {phoneDisplay}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400">
                Trader
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Investio Channel Authenticated</p>
          </div>
        </div>
      </div>

      {/* Settings Navigation List */}
      <div className="glass-panel rounded-3xl border-white/10 overflow-hidden divide-y divide-white/5">
        
        {/* Subscription Item */}
        <Link
          to="/subscribe"
          className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Subscription Package</div>
              <div className="text-xs text-slate-400 mt-0.5">{planName}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isSubscribed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {isSubscribed ? 'Active' : 'Expired'}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </div>
        </Link>

        {/* Broker Item */}
        <Link
          to="/broker"
          className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Plug className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Connected Broker</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {isBrokerConnected ? `${userData?.broker} (MT4/MT5)` : 'No broker linked'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isBrokerConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
            }`}>
              {isBrokerConnected ? 'Linked' : 'Not Linked'}
            </span>
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </div>
        </Link>

        {/* Expiry Date (if subscribed) */}
        {isSubscribed && (
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Subscription Renewal</div>
                <div className="text-xs text-slate-400 mt-0.5">{expiresAt}</div>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono font-bold">30-Day Cycle</span>
          </div>
        )}
      </div>

      {/* Security Info Card */}
      <div className="glass-panel p-5 rounded-3xl border-white/10 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed">
          Your account is secured via Investio's payment channel. Deposit confirmations and trade executions are logged in real time.
        </p>
      </div>

      {/* Sign Out Action */}
      <button
        id="settings-logout-button"
        onClick={handleLogout}
        className="w-full py-4 px-6 rounded-2xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-400 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out From TradeBot</span>
      </button>
    </div>
  );
}
