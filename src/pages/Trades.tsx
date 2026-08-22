import { useState } from 'react';
import {
  Activity,
  Clock,
  Filter,
  Bot,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { Trade } from '../lib/constants';

// Demo trades
const ALL_TRADES: Trade[] = [
  { id: 't1', pair: 'EURUSD', direction: 'BUY', lotSize: 0.05, entryPrice: 1.0842, currentPrice: 1.0867, pnl: 12.50, status: 'open', openedAt: Date.now() - 3600000 },
  { id: 't2', pair: 'GBPUSD', direction: 'SELL', lotSize: 0.03, entryPrice: 1.2710, currentPrice: 1.2685, pnl: 7.50, status: 'open', openedAt: Date.now() - 7200000 },
  { id: 't3', pair: 'XAUUSD', direction: 'BUY', lotSize: 0.01, entryPrice: 2425.50, exitPrice: 2438.20, pnl: 12.70, status: 'closed', openedAt: Date.now() - 86400000, closedAt: Date.now() - 43200000 },
  { id: 't4', pair: 'USDJPY', direction: 'SELL', lotSize: 0.02, entryPrice: 154.85, exitPrice: 155.10, pnl: -5.00, status: 'closed', openedAt: Date.now() - 172800000, closedAt: Date.now() - 86400000 },
  { id: 't5', pair: 'EURJPY', direction: 'BUY', lotSize: 0.04, entryPrice: 168.50, exitPrice: 168.95, pnl: 18.00, status: 'closed', openedAt: Date.now() - 259200000, closedAt: Date.now() - 172800000 },
  { id: 't6', pair: 'AUDUSD', direction: 'BUY', lotSize: 0.02, entryPrice: 0.6520, exitPrice: 0.6545, pnl: 5.00, status: 'closed', openedAt: Date.now() - 345600000, closedAt: Date.now() - 259200000 },
  { id: 't7', pair: 'USDCAD', direction: 'SELL', lotSize: 0.03, entryPrice: 1.3640, exitPrice: 1.3618, pnl: 6.60, status: 'closed', openedAt: Date.now() - 432000000, closedAt: Date.now() - 345600000 },
  { id: 't8', pair: 'GBPJPY', direction: 'BUY', lotSize: 0.01, entryPrice: 196.80, exitPrice: 196.45, pnl: -3.50, status: 'closed', openedAt: Date.now() - 518400000, closedAt: Date.now() - 432000000 },
];

type TradeFilter = 'all' | 'open' | 'closed';

export default function Trades() {
  const [filter, setFilter] = useState<TradeFilter>('all');

  const filteredTrades = ALL_TRADES.filter((t) => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const openCount = ALL_TRADES.filter((t) => t.status === 'open').length;
  const closedCount = ALL_TRADES.filter((t) => t.status === 'closed').length;
  const totalPnl = ALL_TRADES.reduce((sum, t) => sum + t.pnl, 0);

  const formatDate = (ms: number) => {
    return new Date(ms).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Trades</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          All your bot-executed trades in one place.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Open</span>
          <p className="text-lg font-black mt-1 text-[var(--accent-amber)]">{openCount}</p>
        </div>
        <div className="glass-card p-4">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Closed</span>
          <p className="text-lg font-black mt-1">{closedCount}</p>
        </div>
        <div className="glass-card p-4">
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total P&L</span>
          <p className={`text-lg font-black mt-1 ${totalPnl >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-rose)]'}`}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        {(['all', 'open', 'closed'] as TradeFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
              filter === f
                ? 'bg-[var(--accent-blue)] text-white shadow-md shadow-blue-500/20'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] bg-[var(--bg-card)]'
            }`}
          >
            {f} {f === 'open' ? `(${openCount})` : f === 'closed' ? `(${closedCount})` : `(${ALL_TRADES.length})`}
          </button>
        ))}
      </div>

      {/* Trade List */}
      <div className="glass-card overflow-hidden">
        {filteredTrades.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
            <p className="text-xs text-[var(--text-muted)] font-semibold">No trades found</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {filteredTrades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between p-4 sm:p-5 hover:bg-[var(--bg-card-hover)] transition-colors"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    trade.direction === 'BUY'
                      ? 'bg-[var(--accent-emerald-dim)]'
                      : 'bg-[var(--accent-rose-dim)]'
                  }`}>
                    {trade.direction === 'BUY' ? (
                      <TrendingUp className="w-4 h-4 text-[var(--accent-emerald)]" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-[var(--accent-rose)]" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{trade.pair}</p>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                        trade.direction === 'BUY'
                          ? 'bg-[var(--accent-emerald-dim)] text-[var(--accent-emerald)]'
                          : 'bg-[var(--accent-rose-dim)] text-[var(--accent-rose)]'
                      }`}>
                        {trade.direction}
                      </span>
                      {trade.status === 'open' && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-[var(--accent-amber)]">
                          <Activity className="w-2.5 h-2.5" /> LIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDate(trade.openedAt)}
                      {trade.closedAt && ` → ${formatDate(trade.closedAt)}`}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-sm font-black ${trade.pnl >= 0 ? 'text-[var(--accent-emerald)]' : 'text-[var(--accent-rose)]'}`}>
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {trade.lotSize} lots &bull; {trade.entryPrice} → {trade.exitPrice || trade.currentPrice}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
