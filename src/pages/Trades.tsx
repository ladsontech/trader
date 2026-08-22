import { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { Trade } from '../lib/constants';

const ALL_TRADES: Trade[] = [
  { id: 't1', pair: 'EUR/USD', direction: 'BUY', lotSize: 0.05, entryPrice: 1.0842, currentPrice: 1.0874, pnl: 16.00, status: 'open', openedAt: Date.now() - 3600000 },
  { id: 't2', pair: 'XAU/USD (Gold)', direction: 'BUY', lotSize: 0.02, entryPrice: 2898.50, currentPrice: 2914.80, pnl: 32.60, status: 'open', openedAt: Date.now() - 7200000 },
  { id: 't3', pair: 'GBP/USD', direction: 'SELL', lotSize: 0.04, entryPrice: 1.2740, currentPrice: 1.2715, pnl: 10.00, status: 'open', openedAt: Date.now() - 10800000 },
  { id: 't4', pair: 'USD/JPY', direction: 'SELL', lotSize: 0.03, entryPrice: 154.80, exitPrice: 154.20, pnl: 18.00, status: 'closed', openedAt: Date.now() - 86400000, closedAt: Date.now() - 43200000 },
  { id: 't5', pair: 'GBP/JPY', direction: 'BUY', lotSize: 0.04, entryPrice: 195.10, exitPrice: 196.45, pnl: 27.00, status: 'closed', openedAt: Date.now() - 172800000, closedAt: Date.now() - 86400000 },
  { id: 't6', pair: 'AUD/USD', direction: 'BUY', lotSize: 0.03, entryPrice: 0.6520, exitPrice: 0.6565, pnl: 13.50, status: 'closed', openedAt: Date.now() - 259200000, closedAt: Date.now() - 172800000 },
  { id: 't7', pair: 'USD/CAD', direction: 'SELL', lotSize: 0.04, entryPrice: 1.3640, exitPrice: 1.3590, pnl: 15.00, status: 'closed', openedAt: Date.now() - 345600000, closedAt: Date.now() - 259200000 },
  { id: 't8', pair: 'NZD/USD', direction: 'BUY', lotSize: 0.02, entryPrice: 0.5910, exitPrice: 0.5895, pnl: -3.00, status: 'closed', openedAt: Date.now() - 432000000, closedAt: Date.now() - 345600000 },
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
    <div className="space-y-6 sm:space-y-8 animate-slide-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Trades & Execution Log
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time algorithmic order stream routed to your connected broker.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-white/5 rounded-2xl shrink-0">
          {(['all', 'open', 'closed'] as TradeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                filter === f
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {f} {f === 'open' ? `(${openCount})` : f === 'closed' ? `(${closedCount})` : `(${ALL_TRADES.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Summary Bar */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="glass-panel p-4 rounded-2xl border-white/10">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Open Orders</div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono mt-1">{openCount}</div>
        </div>
        <div className="glass-panel p-4 rounded-2xl border-white/10">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Closed Orders</div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono mt-1">{closedCount}</div>
        </div>
        <div className="glass-panel p-4 rounded-2xl border-white/10">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cumulative P&L</div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono mt-1">
            +${totalPnl.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Trades Table / Cards */}
      <div className="glass-panel rounded-3xl border-white/10 overflow-hidden divide-y divide-white/5">
        {filteredTrades.map((t) => (
          <div key={t.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs font-mono shadow-sm ${
                t.direction === 'BUY'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }`}>
                {t.direction === 'BUY' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-sm sm:text-base">{t.pair}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    t.direction === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    {t.direction} {t.lotSize}L
                  </span>
                  {t.status === 'open' && (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span> Live
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  In: <span className="text-slate-300 font-bold">{t.entryPrice}</span> &bull; {t.status === 'open' ? 'Current: ' : 'Out: '}
                  <span className="text-slate-300 font-bold">{t.exitPrice || t.currentPrice}</span>
                </div>
              </div>
            </div>

            {/* Right Profit & Timestamp */}
            <div className="text-right">
              <div className={`text-sm sm:text-base font-black font-mono ${
                t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {t.pnl >= 0 ? `+$${t.pnl.toFixed(2)}` : `-$${Math.abs(t.pnl).toFixed(2)}`}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                {formatDate(t.openedAt)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
