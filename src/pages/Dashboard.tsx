import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../lib/auth-context';
import {
  apiErrorMessage,
  brokerState,
  getTrades,
  setBotEnabled,
  type BrokerState,
  type TradesResult,
} from '../lib/api';
import { planById, STRATEGY_LABEL, TIMEFRAME_LABEL } from '../lib/constants';
import {
  daysLeft,
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
  SectionTitle,
  Spinner,
  Stat,
  StatusDot,
  cx,
} from '../components/ui';
import { Activity, Pause, Play, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const { userData, refreshUserData } = useAuth();
  const [account, setAccount] = useState<BrokerState | null>(null);
  const [trades, setTrades] = useState<TradesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [accountResult, tradesResult] = await Promise.all([
        brokerState(),
        getTrades(30).catch(() => null),
      ]);
      setAccount(accountResult);
      if (tradesResult) setTrades(tradesResult);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reach your broker account right now.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const toggleBot = async () => {
    setToggling(true);
    try {
      await setBotEnabled(!userData?.botEnabled);
      await refreshUserData();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not change the bot setting.'));
    } finally {
      setToggling(false);
    }
  };

  const plan = planById(userData?.subscriptionPlan);
  const remaining = daysLeft(userData?.subscriptionExpiresAt);
  const currency = account?.currency || userData?.brokerCurrency || 'USD';
  const running = Boolean(userData?.botEnabled) && account?.connected === true;
  const floating = account?.floatingPnl ?? trades?.stats.floatingPnl ?? 0;
  const realized = trades?.stats.realizedPnl ?? 0;

  if (loading) {
    return (
      <div className="max-w-4xl">
        <Spinner label="Loading your account" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-ink-soft mt-1">
            {running ? (
              <span className="inline-flex items-center gap-1.5">
                <StatusDot tone="up" />
                Bot is running on {account?.broker}
              </span>
            ) : account?.connected ? (
              <span className="inline-flex items-center gap-1.5">
                <StatusDot tone="warn" />
                Bot is paused
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <StatusDot tone="idle" />
                Waiting for the broker connection
              </span>
            )}
          </p>
        </div>

        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="btn btn-ghost px-3 py-2"
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

      {/* Account numbers, straight from the broker */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          label="Equity"
          value={money(account?.equity ?? 0, currency)}
          hint={`Balance ${money(account?.balance ?? 0, currency)}`}
        />
        <Stat
          label="Open P&L"
          value={signedMoney(floating, currency)}
          tone={floating > 0 ? 'up' : floating < 0 ? 'down' : 'neutral'}
          hint={`${account?.openPositions ?? trades?.stats.openCount ?? 0} open`}
        />
        <Stat
          label="Closed (30d)"
          value={signedMoney(realized, currency)}
          tone={realized > 0 ? 'up' : realized < 0 ? 'down' : 'neutral'}
          hint={`${trades?.stats.closedCount ?? 0} trades`}
        />
        <Stat
          label="Win rate"
          value={trades ? percent(trades.stats.winRate) : '—'}
          hint={
            trades ? `${trades.stats.wins}W / ${trades.stats.losses}L` : 'No history yet'
          }
        />
      </div>

      {/* Bot control */}
      <Card className="p-4 mt-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-surface-2 border border-line flex items-center justify-center text-ink-soft shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[14px] font-semibold">{STRATEGY_LABEL}</p>
              <p className="text-[12px] text-ink-faint mt-0.5">
                {TIMEFRAME_LABEL} · checked every 15 minutes ·{' '}
                {userData?.lastBotRunAt
                  ? `last run ${timeAgo(userData.lastBotRunAt)}`
                  : 'first run pending'}
              </p>
            </div>
          </div>

          <Button variant="ghost" loading={toggling} onClick={toggleBot}>
            {userData?.botEnabled ? (
              <>
                <Pause className="w-4 h-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Resume
              </>
            )}
          </Button>
        </div>

        {plan && (
          <>
            <div className="divider my-4" />
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
              <span className="chip">{plan.name} plan</span>
              <span className="chip">{plan.pairs}</span>
              <span className="chip">{plan.riskPercent}% risk per trade</span>
              <span
                className={cx('chip', remaining <= 3 && 'border-warn/30 text-warn')}
              >
                {remaining} {remaining === 1 ? 'day' : 'days'} left
              </span>
            </div>
          </>
        )}
      </Card>

      {/* Open positions */}
      <div className="mt-8">
        <SectionTitle
          title="Open positions"
          subtitle="Live from your broker account."
          action={
            <Link to="/trades" className="text-[13px] text-accent hover:underline">
              All trades
            </Link>
          }
        />

        {!trades || trades.open.length === 0 ? (
          <EmptyState title="Nothing open right now">
            The bot only enters when its trend and pullback rules agree. Most cycles it
            waits — that restraint is deliberate.
          </EmptyState>
        ) : (
          <Card className="overflow-hidden">
            {trades.open.map((position, index) => (
              <div
                key={position.id}
                className={cx(
                  'px-4 py-3.5 flex items-center justify-between gap-4',
                  index > 0 && 'border-t border-line'
                )}
              >
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
                      {position.direction} {position.volume}
                    </span>
                  </div>
                  <p className="tnum text-[12px] text-ink-faint mt-1 truncate">
                    {price(position.openPrice)} → {price(position.currentPrice)}
                    {position.stopLoss ? ` · SL ${price(position.stopLoss)}` : ''}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p
                    className={cx(
                      'tnum text-[14px]',
                      position.profit >= 0 ? 'text-up' : 'text-down'
                    )}
                  >
                    {signedMoney(position.profit, currency)}
                  </p>
                  <p className="text-[11px] text-ink-faint">{timeAgo(position.openedAt)}</p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
