import { useAuth } from '../lib/auth-context';
import { Link } from 'react-router';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  ArrowRight,
  Bot,
  Wifi,
  WifiOff,
  Zap,
  Clock,
} from 'lucide-react';
import type { Trade } from '../lib/constants';

// Demo trades for display
const DEMO_TRADES: Trade[] = [
  { id: 't1', pair: 'EURUSD', direction: 'BUY', lotSize: 0.05, entryPrice: 1.0842, currentPrice: 1.0867, pnl: 12.50, status: 'open', openedAt: Date.now() - 3600000 },
  { id: 't2', pair: 'GBPUSD', direction: 'SELL', lotSize: 0.03, entryPrice: 1.2710, currentPrice: 1.2685, pnl: 7.50, status: 'open', openedAt: Date.now() - 7200000 },
  { id: 't3', pair: 'XAUUSD', direction: 'BUY', lotSize: 0.01, entryPrice: 2425.50, exitPrice: 2438.20, pnl: 12.70, status: 'closed', openedAt: Date.now() - 86400000, closedAt: Date.now() - 43200000 },
  { id: 't4', pair: 'USDJPY', direction: 'SELL', lotSize: 0.02, entryPrice: 154.85, exitPrice: 155.10, pnl: -5.00, status: 'closed', openedAt: Date.now() - 172800000, closedAt: Date.now() - 86400000 },
  { id: 't5', pair: 'EURJPY', direction: 'BUY', lotSize: 0.04, entryPrice: 168.50, exitPrice: 168.95, pnl: 18.00, status: 'closed', openedAt: Date.now() - 259200000, closedAt: Date.now() - 172800000 },
];

export default function Dashboard() {
  const { userData } = useAuth();

  const isSubscribed = userData?.subscriptionStatus === 'active';
  const isBrokerConnected = userData?.brokerConnected === true;

  const activeTrades = DEMO_TRADES.filter((t) => t.status === 'open');
  const recentClosed = DEMO_TRADES.filter((t) => t.status === 'closed').slice(0, 3);

  const totalPnl = DEMO_TRADES.reduce((sum, t) => sum + t.pnl, 0);
  const winCount = DEMO_TRADES.filter((t) => t.pnl > 0).length;
  const winRate = DEMO_TRADES.length > 0 ? Math.round((winCount / DEMO_TRADES.length) * 100) : 0;

  const formatTime = (ms: number) => {
    const date = new Date(ms);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 stagger-children">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Monitor your trades and bot performance.
        </p>
      </div>

      {/* Subscription & Broker Status */}
      {(!isSubscribed || !isBrokerConnected) && (
        <div className="glass-card p-5 sm:p-6 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Zap className="w-4 h-4 text-[var(--accent-amber)]" />
            Get Started
          </h3>
          <div className="space-y-2.5">
            {!isSubscribed && (
              <Link
                to="/subscribe"
                className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--accent-blue)]/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-[var(--accent-blue)]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Subscribe to a plan</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Starting from UGX 50,000</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-blue)] transition-colors" />
              </Link>
            )}
            {isSubscribed && !isBrokerConnected && (
              <Link
                to="/broker"
                className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--accent-emerald)]/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--accent-emerald)]/10 flex items-center justify-center">
                    <Wifi className="w-4 h-4 text-[var(--accent-emerald)]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Connect your broker</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Exness or FBS</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-emerald)] transition-colors" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total P&L */}
        <div className="glass-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total P&L</span>
            {totalPnl >= 0 ? (
              <TrendingUp className="w-4 h-4 text-[var(--accent-emerald)]" />
            ) : (
              <TrendingDown className="w-4 h-4 text-[var(--accent-rose)]" />
            )}
          </div>
          <p className={`text-xl sm:text-2xl font-black ${totalPnl >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-rose)]'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </p>
        </div>

        {/* Win Rate */}
        <div className="glass-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Win Rate</span>
            <BarChart3 className="w-4 h-4 text-[var(--accent-blue)]" />
          </div>
          <p className="text-xl sm:text-2xl font-black">{winRate}%</p>
        </div>

        {/* Active Trades */}
        <div className="glass-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Active</span>
            <Activity className="w-4 h-4 text-[var(--accent-amber)]" />
          </div>
          <p className="text-xl sm:text-2xl font-black">{activeTrades.length}</p>
        </div>

        {/* Broker Status */}
        <div className="glass-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Broker</span>
            {isBrokerConnected ? (
              <Wifi className="w-4 h-4 text-[var(--accent-emerald)]" />
            ) : (
              <WifiOff className="w-4 h-4 text-[var(--text-muted)]" />
            )}
          </div>
          {isBrokerConnected ? (
            <div className="badge-active">{userData?.broker || 'Connected'}</div>
          ) : (
            <div className="badge-inactive">Disconnected</div>
          )}
        </div>
      </div>

      {/* Active Trades */}
      <div className="glass-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--accent-emerald)]" />
            Active Trades
          </h3>
          <Link to="/trades" className="text-[10px] font-bold text-[var(--accent-blue)] hover:underline flex items-center gap-1">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {activeTrades.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
            <p className="text-xs text-[var(--text-muted)] font-semibold">No active trades right now</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">The bot will open trades when conditions are right.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeTrades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${
                    trade.direction === 'BUY'
                      ? 'bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)]'
                      : 'bg-[var(--accent-rose-dim)] text-[var(--accent-rose)]'
                  }`}>
                    {trade.direction === 'BUY' ? '▲' : '▼'}
                  </div>
                  <div>
                    <p className="text-xs font-bold">{trade.pair}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {trade.direction} &bull; {trade.lotSize} lots &bull; {formatTime(trade.openedAt)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-black ${trade.pnl >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-rose)]'}`}>
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {trade.entryPrice} → {trade.currentPrice}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Closed Trades */}
      <div className="glass-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--text-muted)]" />
            Recently Closed
          </h3>
        </div>
        <div className="space-y-2">
          {recentClosed.map((trade) => (
            <div
              key={trade.id}
              className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)]"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${
                  trade.direction === 'BUY'
                    ? 'bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)]'
                    : 'bg-[var(--accent-rose-dim)] text-[var(--accent-rose)]'
                }`}>
                  {trade.direction === 'BUY' ? '▲' : '▼'}
                </div>
                <div>
                  <p className="text-xs font-bold">{trade.pair}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {trade.direction} &bull; {trade.lotSize} lots
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-xs font-black ${trade.pnl >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-rose)]'}`}>
                  {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {trade.entryPrice} → {trade.exitPrice}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
