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
  const recentClosed = DEMO_TRADES.filter((t) => t.status === 'closed');

  const totalPnl = DEMO_TRADES.reduce((sum, t) => sum + t.pnl, 0);
  const winCount = DEMO_TRADES.filter((t) => t.pnl > 0).length;
  const winRate = DEMO_TRADES.length > 0 ? Math.round((winCount / DEMO_TRADES.length) * 100) : 0;

  const formatTime = (ms: number) => {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* ── HERO BANNER ── */}
      <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#111C35] to-[#0A1020] border border-white/[0.08] shadow-xl relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{isBrokerConnected ? 'Bot Live & Trading' : isSubscribed ? 'Connect Broker to Start' : 'Deposit to Activate Bot'}</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Forex Trading Terminal
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-400 max-w-md leading-relaxed">
              Automated algorithmic order execution synced to your Exness or FBS broker.
            </p>
          </div>

          {/* Action CTA */}
          <div className="shrink-0">
            {!isSubscribed ? (
              <Link
                to="/subscribe"
                className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" /> Subscribe Plan
              </Link>
            ) : !isBrokerConnected ? (
              <Link
                to="/broker"
                className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Plug className="w-4 h-4" /> Connect Broker
              </Link>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold font-mono">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{userData?.broker} Active</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── STATS 2x2 GRID (Never Squished on Mobile) ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        
        {/* Total Net Profit */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0F172A] border border-white/[0.08] shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Total Net Profit</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            +${totalPnl.toFixed(2)}
          </div>
          <div className="text-[10px] text-emerald-400 font-bold">+18.4% this month</div>
        </div>

        {/* Win Rate */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0F172A] border border-white/[0.08] shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Win Rate</span>
            <div className="w-7 h-7 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {winRate}%
          </div>
          <div className="text-[10px] text-slate-400">{winCount} of {DEMO_TRADES.length} wins</div>
        </div>

        {/* Active Trades */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0F172A] border border-white/[0.08] shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Active Trades</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {activeTrades.length} <span className="text-xs text-amber-400 font-semibold">Live</span>
          </div>
          <div className="text-[10px] text-slate-400">8 pairs scanned</div>
        </div>

        {/* Broker Connection */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0F172A] border border-white/[0.08] shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Broker</span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <Plug className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm sm:text-lg font-black text-white truncate">
            {isBrokerConnected ? userData?.broker : 'Disconnected'}
          </div>
          <div className="text-[10px] text-slate-400">
            {isBrokerConnected ? '18ms Server Latency' : 'Exness or FBS'}
          </div>
        </div>
      </div>

      {/* ── ACTIVE LIVE TRADES LIST ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
            <h2 className="text-base font-black text-white tracking-tight">Active Live Orders</h2>
          </div>
          <Link to="/trades" className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1">
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-[#0F172A] rounded-2xl sm:rounded-3xl border border-white/[0.08] divide-y divide-white/[0.05] overflow-hidden shadow-sm">
          {activeTrades.map((trade) => (
            <div key={trade.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs font-mono shrink-0 ${
                  trade.direction === 'BUY'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {trade.direction}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-white text-sm">{trade.pair}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-white/5 text-slate-400">
                      {trade.lotSize}L
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    In: <span className="text-slate-300 font-semibold">{trade.entryPrice}</span> &bull; Now: <span className="text-slate-300 font-semibold">{trade.currentPrice}</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-sm font-black text-emerald-400 font-mono">
                  +${trade.pnl.toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {formatTime(trade.openedAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RECENTLY CLOSED ORDERS ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Recently Closed</span>
          </h2>
        </div>

        <div className="bg-[#0F172A] rounded-2xl sm:rounded-3xl border border-white/[0.08] divide-y divide-white/[0.05] overflow-hidden shadow-sm">
          {recentClosed.map((trade) => (
            <div key={trade.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs font-mono shrink-0 ${
                  trade.direction === 'BUY'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                }`}>
                  {trade.direction}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-white text-sm">{trade.pair}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-white/5 text-slate-400">
                      {trade.lotSize}L
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Out: <span className="text-slate-300 font-semibold">{trade.exitPrice}</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className={`text-sm font-black font-mono ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {trade.pnl >= 0 ? `+$${trade.pnl.toFixed(2)}` : `-$${Math.abs(trade.pnl).toFixed(2)}`}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Closed
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
