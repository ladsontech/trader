import { useCallback, useEffect, useState } from 'react';
import {
  apiErrorMessage,
  closePosition,
  getTrades,
  type TradesResult,
} from '../lib/api';
import { useAuth } from '../lib/auth-context';
import {
  dateTime,
  money,
  pairLabel,
  percent,
  price,
  signedMoney,
  timeAgo,
} from '../lib/format';
import {
  Button,
  Card,
  EmptyState,
  Notice,
  PageTitle,
  Spinner,
  Stat,
  cx,
} from '../components/ui';
import { BarChart3, RefreshCw, X } from 'lucide-react';

type Filter = 'open' | 'closed';

export default function Trades() {
  const { userData } = useAuth();
  const [data, setData] = useState<TradesResult | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [closingId, setClosingId] = useState<string | null>(null);

  const currency = userData?.brokerCurrency || 'USD';

  const load = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      setData(await getTrades(90));
    } catch (err) {
      setError(
        apiErrorMessage(err, 'Could not load your trades from the broker right now.')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleClose = async (positionId: string) => {
    setClosingId(positionId);
    setError('');
    try {
      await closePosition(positionId);
      await load(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'The broker rejected the close request.'));
    } finally {
      setClosingId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl">
        <Spinner label="Loading your trade history" />
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <PageTitle
          title="Trades"
          subtitle="Every order the bot placed on your broker account, read back from the broker itself."
        />
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn btn-ghost px-3 py-2 shrink-0"
          aria-label="Refresh"
        >
          <RefreshCw className={cx('w-4 h-4', refreshing && 'animate-spin')} />
        </button>
      </div>

      {error && (
        <div className="mb-4">
          <Notice tone="warn">{error}</Notice>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Open" value={String(stats?.openCount ?? 0)} />
        <Stat
          label="Floating P&L"
          value={signedMoney(stats?.floatingPnl ?? 0, currency)}
          tone={(stats?.floatingPnl ?? 0) >= 0 ? 'up' : 'down'}
        />
        <Stat
          label="Realised (90d)"
          value={signedMoney(stats?.realizedPnl ?? 0, currency)}
          tone={(stats?.realizedPnl ?? 0) >= 0 ? 'up' : 'down'}
        />
        <Stat
          label="Win rate"
          value={stats ? percent(stats.winRate) : '—'}
          hint={stats ? `${stats.wins}W / ${stats.losses}L` : undefined}
        />
      </div>

      {/* Filter */}
      <div className="mt-6 inline-flex p-1 rounded-[10px] bg-surface border border-line">
        {(['open', 'closed'] as Filter[]).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cx(
              'px-4 py-1.5 rounded-[7px] text-[13px] font-semibold capitalize transition-colors cursor-pointer',
              filter === value ? 'bg-surface-3 text-ink' : 'text-ink-soft hover:text-ink'
            )}
          >
            {value} (
            {value === 'open' ? (stats?.openCount ?? 0) : (stats?.closedCount ?? 0)})
          </button>
        ))}
      </div>

      <div className="mt-4">
        {filter === 'open' ? (
          !data || data.open.length === 0 ? (
            <EmptyState icon={<BarChart3 className="w-5 h-5" />} title="No open positions">
              When the bot finds a setup that passes its trend and risk checks, the position
              will appear here.
            </EmptyState>
          ) : (
            <Card className="overflow-hidden">
              {data.open.map((position, index) => (
                <div
                  key={position.id}
                  className={cx('px-4 py-4', index > 0 && 'border-t border-line')}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold">
                          {pairLabel(position.symbol)}
                        </span>
                        <span
                          className={cx(
                            'chip',
                            position.direction === 'BUY'
                              ? 'border-up/30 text-up'
                              : 'border-down/30 text-down'
                          )}
                        >
                          {position.direction} {position.volume} lots
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-faint mt-1">
                        Opened {timeAgo(position.openedAt)}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={cx(
                          'tnum text-[15px]',
                          position.profit >= 0 ? 'text-up' : 'text-down'
                        )}
                      >
                        {signedMoney(position.profit, currency)}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4">
                    <Cell label="Entry" value={price(position.openPrice)} />
                    <Cell label="Now" value={price(position.currentPrice)} />
                    <Cell label="Stop loss" value={price(position.stopLoss)} />
                    <Cell label="Take profit" value={price(position.takeProfit)} />
                  </dl>

                  <div className="mt-3.5">
                    <Button
                      variant="ghost"
                      loading={closingId === position.id}
                      onClick={() => handleClose(position.id)}
                      className="text-[12px] py-1.5 px-3"
                    >
                      <X className="w-3.5 h-3.5" />
                      Close now
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          )
        ) : !data || data.closed.length === 0 ? (
          <EmptyState icon={<BarChart3 className="w-5 h-5" />} title="No closed trades yet">
            Closed positions from the last 90 days will be listed here with the exact profit
            or loss your broker recorded.
          </EmptyState>
        ) : (
          <Card className="overflow-hidden">
            {data.closed.map((deal, index) => {
              const net = deal.profit + deal.commission + deal.swap;
              return (
                <div
                  key={deal.id}
                  className={cx(
                    'px-4 py-3.5 flex items-center justify-between gap-4',
                    index > 0 && 'border-t border-line'
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold">{pairLabel(deal.symbol)}</p>
                    <p className="tnum text-[11px] text-ink-faint mt-0.5">
                      {deal.volume} lots @ {price(deal.price)} · {dateTime(deal.closedAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cx('tnum text-[14px]', net >= 0 ? 'text-up' : 'text-down')}>
                      {signedMoney(net, currency)}
                    </p>
                    {(deal.commission !== 0 || deal.swap !== 0) && (
                      <p className="tnum text-[11px] text-ink-faint">
                        fees {money(deal.commission + deal.swap, currency)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </dt>
      <dd className="tnum text-[13px] mt-0.5">{value}</dd>
    </div>
  );
}
