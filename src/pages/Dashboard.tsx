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
  remainingLabel,
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
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
          <p className="text-[13px] text-ink-soft mt-1">
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

      {/* Exness Personal Area style MT5 account summary banner */}
      <Card className="p-5 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded bg-[#ffcf01] px-2 py-0.5 text-[11px] font-bold text-[#0b0e11]">
              {account?.broker || userData?.broker || 'MT5'}
            </span>
            <span className="chip">MT5 Real</span>
            {(account?.accountMasked || userData?.brokerAccountId) && (
              <span className="chip tnum">#{account?.accountMasked || userData?.brokerAccountId}</span>
            )}
            {(account?.server || userData?.brokerServer) && (
              <span className="text-[12px] text-ink-faint hidden sm:inline">
                {account?.server || userData?.brokerServer}
              </span>
            )}
          </div>
          {account?.leverage && (
            <span className="chip tnum">1:{account.leverage}</span>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
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
      </Card>

      {/* Bot control */}
      <Card className="p-4">
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
              <span className={cx('chip', remaining <= 7 && 'border-warn/30 text-warn')}>
                {remainingLabel(userData?.subscriptionExpiresAt)}
              </span>
            </div>
          </>
        )}
      </Card>

      {/* Open positions */}
      <div className="mt-7">
        <SectionTitle
          title="Open positions"
          subtitle="Live from your broker account."
          action={
            <Link to="/trades" className="text-[13px] font-semibold text-accent hover:underline">
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
                  'px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-surface-2/40 transition-colors',
                  index > 0 && 'border-t border-line'
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold">
                      {pairLabel(position.symbol)}
                    </span>
                    <span
                      className={cx(
                        'inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-bold tnum',
                        position.direction === 'BUY'
                          ? 'bg-up/12 text-up'
                          : 'bg-down/12 text-down'
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
                      'tnum text-[14px] font-bold',
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
