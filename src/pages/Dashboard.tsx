import { useAuth } from '../lib/auth-context';
import { Link } from 'react-router';
import {
  TrendingUp,
  Activity,
  BarChart3,
  ArrowRight,
  Zap,
  Clock,
  Plug,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import type { Trade } from '../lib/constants';

const DEMO_TRADES: Trade[] = [
  { id: 't1', pair: 'EUR/USD', direction: 'BUY', lotSize: 0.05, entryPrice: 1.0842, currentPrice: 1.0874, pnl: 16.00, status: 'open', openedAt: Date.now() - 3600000 },
  { id: 't2', pair: 'XAU/USD (Gold)', direction: 'BUY', lotSize: 0.02, entryPrice: 2898.50, currentPrice: 2914.80, pnl: 32.60, status: 'open', openedAt: Date.now() - 7200000 },
  { id: 't3', pair: 'GBP/USD', direction: 'SELL', lotSize: 0.04, entryPrice: 1.2740, currentPrice: 1.2715, pnl: 10.00, status: 'open', openedAt: Date.now() - 10800000 },
  { id: 't4', pair: 'USD/JPY', direction: 'SELL', lotSize: 0.03, entryPrice: 154.80, exitPrice: 154.20, pnl: 18.00, status: 'closed', openedAt: Date.now() - 86400000, closedAt: Date.now() - 43200000 },
  { id: 't5', pair: 'GBP/JPY', direction: 'BUY', lotSize: 0.04, entryPrice: 195.10, exitPrice: 196.45, pnl: 27.00, status: 'closed', openedAt: Date.now() - 172800000, closedAt: Date.now() - 86400000 },
];

export default function Dashboard() {
  const { userData } = useAuth();

  const isSubscribed = userData?.subscriptionStatus === 'active';
  const isBrokerConnected = userData?.brokerConnected === true;

  const activeTrades = DEMO_TRADES.filter((t) => t.status === 'open');

  const totalPnl = DEMO_TRADES.reduce((sum, t) => sum + t.pnl, 0);
  const winCount = DEMO_TRADES.filter((t) => t.pnl > 0).length;
  const winRate = DEMO_TRADES.length > 0 ? Math.round((winCount / DEMO_TRADES.length) * 100) : 0;

  const formatTime = (ms: number) => {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-slide-in">
      
      {/* Top Hero Banner & Bot Status */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border-white/10 relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{isBrokerConnected ? 'Bot Running & Syncing' : isSubscribed ? 'Ready to Connect Broker' : 'Subscription Required'}</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              Automated Trading Terminal
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl">
              Real-time algorithm monitoring multi-asset Forex & Gold pairs. Orders are routed directly to your connected broker.
            </p>
          </div>

          {/* Quick Action CTA Button */}
          <div className="flex flex-wrap sm:flex-col gap-2.5 shrink-0">
            {!isSubscribed ? (
              <Link
                to="/subscribe"
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> Subscribe Plan
              </Link>
            ) : !isBrokerConnected ? (
              <Link
                to="/broker"
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Plug className="w-4 h-4" /> Connect Exness / FBS
              </Link>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold font-mono">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Broker: {userData?.broker}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
        
        {/* Total Net Profit */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border-white/10 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Total Net Profit</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-emerald-400 font-mono">
            +${totalPnl.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
            <span className="text-emerald-400 font-bold">+18.4%</span> this month
          </div>
        </div>

        {/* Win Rate */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border-white/10 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Algorithmic Win Rate</span>
            <div className="w-7 h-7 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-white font-mono">
            {winRate}%
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
            <span>{winCount} winning trades</span>
          </div>
        </div>

        {/* Active Open Trades */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border-white/10 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Active Trades</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-3xl font-black text-white font-mono">
            {activeTrades.length} <span className="text-xs text-amber-400 font-normal">Live</span>
          </div>
          <div className="text-[10px] text-slate-400">
            Scanning 8 currency pairs
          </div>
        </div>

        {/* Package / Broker Status */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border-white/10 space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Account Tier</span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base sm:text-xl font-black text-white truncate">
            {isSubscribed ? (userData?.subscriptionPlan === 'premium' ? 'VIP Premium' : 'Standard Plan') : 'Inactive'}
          </div>
          <div className="text-[10px] text-slate-400">
            {isSubscribed ? 'Mobile Money Active' : 'UGX 50k / 100k'}
          </div>
        </div>
      </div>

      {/* Active Trades Live Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight">Active Live Orders</h2>
          </div>
          <Link to="/trades" className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1">
            <span>View Full History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="glass-panel rounded-3xl border-white/10 overflow-hidden divide-y divide-white/5">
          {activeTrades.map((trade) => (
            <div key={trade.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs font-mono shadow-sm ${
                  trade.direction === 'BUY'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {trade.direction}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-sm sm:text-base">{trade.pair}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-white/5 text-slate-300">
                      {trade.lotSize} Lots
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Entry: <span className="text-slate-300 font-semibold">{trade.entryPrice}</span> &bull; Current: <span className="text-slate-300 font-semibold">{trade.currentPrice}</span>
                  </div>
                </div>
              </div>

              {/* Profit & Live Indicator */}
              <div className="text-right">
                <div className="text-sm sm:text-base font-black text-emerald-400 font-mono">
                  +${trade.pnl.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500 font-mono flex items-center justify-end gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatTime(trade.openedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Broker & Platform Integration Banner */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Exness Card */}
        <div className="glass-panel p-5 rounded-3xl border-amber-500/20 bg-amber-950/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span> Exness Broker
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Zero Spread Execution</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Connect your Exness MT4 or MT5 Real account using your trading credentials.
          </p>
          <Link
            to="/broker"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300"
          >
            <span>{isBrokerConnected && userData?.broker === 'Exness' ? 'Manage Connection' : 'Connect Exness'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* FBS Card */}
        <div className="glass-panel p-5 rounded-3xl border-cyan-500/20 bg-cyan-950/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span> FBS Broker
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Ultra Low Latency</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Connect your FBS Real account for high-frequency algorithmic trade execution.
          </p>
          <Link
            to="/broker"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300"
          >
            <span>{isBrokerConnected && userData?.broker === 'FBS' ? 'Manage Connection' : 'Connect FBS'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
