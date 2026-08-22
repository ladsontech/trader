import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../lib/auth-context';
import { BROKERS, type Broker } from '../lib/constants';
import {
  apiErrorMessage,
  brokerState,
  connectBroker,
  disconnectBroker,
  type BrokerState,
} from '../lib/api';
import { money } from '../lib/format';
import { Button, Card, Field, Notice, PageTitle, Spinner, cx } from '../components/ui';
import { ArrowRight, Check, Info, Link2, Lock, Unplug } from 'lucide-react';

export default function ConnectBroker() {
  const { userData, isSubscribed, isBrokerConnected, refreshUserData } = useAuth();
  const [broker, setBroker] = useState<Broker>(BROKERS[0]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState<BrokerState | null>(null);
  const [loadingState, setLoadingState] = useState(false);

  useEffect(() => {
    if (!isBrokerConnected) {
      setState(null);
      return;
    }
    let cancelled = false;
    setLoadingState(true);
    brokerState()
      .then((result) => !cancelled && setState(result))
      .catch(() => !cancelled && setState(null))
      .finally(() => !cancelled && setLoadingState(false));
    return () => {
      cancelled = true;
    };
  }, [isBrokerConnected]);

  /* ── Locked until paid ──────────────────────────────────────── */
  if (!isSubscribed) {
    return (
      <div className="max-w-md">
        <Card className="p-6 text-center">
          <div className="w-11 h-11 rounded-[12px] bg-surface-2 border border-line flex items-center justify-center mx-auto mb-4 text-ink-soft">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-[15px] font-semibold">Choose a plan first</h2>
          <p className="text-[13px] text-ink-soft mt-1.5 leading-relaxed">
            The bot can only be pointed at a broker account once your subscription is active.
          </p>
          <Link to="/subscribe" className="btn btn-primary w-full mt-5">
            See plans
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Card>
      </div>
    );
  }

  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    for (const field of broker.fields) {
      if (!values[field.key]?.trim()) {
        setError(`Enter your ${field.label.toLowerCase()}.`);
        return;
      }
    }

    setConnecting(true);
    try {
      await connectBroker({
        brokerId: broker.id,
        accountId: values.accountId.trim(),
        password: values.password,
        server: values.server.trim(),
      });
      setValues({});
      await refreshUserData();
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          'We could not reach that account. Check the number, password and server name.'
        )
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError('');
    try {
      await disconnectBroker();
      await refreshUserData();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not disconnect. Please try again.'));
    } finally {
      setDisconnecting(false);
    }
  };

  /* ── Connected ──────────────────────────────────────────────── */
  if (isBrokerConnected) {
    return (
      <div className="max-w-2xl">
        <PageTitle
          title="Broker connection"
          subtitle="The bot places orders on this account. You can see every order in your own MetaTrader terminal."
        />

        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[10px] bg-accent-soft border border-accent/25 flex items-center justify-center text-accent">
                <Link2 className="w-[18px] h-[18px]" />
              </div>
              <div>
                <p className="text-[15px] font-semibold">{userData?.broker}</p>
                <p className="text-[12px] text-ink-faint tnum">
                  {state?.accountMasked || userData?.brokerAccountId} ·{' '}
                  {state?.server || userData?.brokerServer}
                </p>
              </div>
            </div>
            <span
              className={cx(
                'chip',
                state?.connected ? 'border-accent/30 text-accent' : 'border-warn/30 text-warn'
              )}
            >
              {state?.connected ? 'Live' : 'Reconnecting'}
            </span>
          </div>

          <div className="divider my-4" />

          {loadingState ? (
            <Spinner label="Reading your account" />
          ) : state?.connected ? (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-y-3.5 gap-x-4">
              <Detail label="Balance" value={money(state.balance ?? 0, state.currency)} />
              <Detail label="Equity" value={money(state.equity ?? 0, state.currency)} />
              <Detail label="Free margin" value={money(state.freeMargin ?? 0, state.currency)} />
              <Detail label="Leverage" value={`1:${state.leverage ?? '—'}`} />
            </dl>
          ) : (
            <Notice tone="warn">
              {state?.error ||
                'We cannot read the account right now. This usually clears by itself; if it persists, reconnect with a fresh password.'}
            </Notice>
          )}

          {state?.tradeAllowed === false && (
            <div className="mt-4">
              <Notice tone="warn" title="Trading disabled at the broker">
                Your broker has algorithmic trading switched off for this account. The bot
                cannot place orders until you enable it.
              </Notice>
            </div>
          )}

          <div className="divider my-4" />

          <Button variant="danger" block loading={disconnecting} onClick={handleDisconnect}>
            <Unplug className="w-4 h-4" />
            Disconnect this account
          </Button>
        </Card>

        {error && (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
      </div>
    );
  }

  /* ── Connect form ───────────────────────────────────────────── */
  return (
    <div className="max-w-2xl">
      <PageTitle
        title="Connect your broker"
        subtitle="TradeBot trades on your own MetaTrader 5 account. Your money stays with your broker and you can disconnect at any time."
      />

      <div className="grid sm:grid-cols-2 gap-3">
        {BROKERS.map((b) => {
          const active = broker.id === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setBroker(b);
                setValues({});
                setError('');
              }}
              className={cx(
                'text-left p-4 rounded-[14px] border transition-colors cursor-pointer',
                active
                  ? 'border-accent/50 bg-accent/[0.04]'
                  : 'border-line bg-surface hover:border-line-strong'
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[15px] font-semibold"
                  style={{ backgroundColor: `${b.tint}1a`, color: b.tint }}
                >
                  {b.mark}
                </span>
                <span
                  className={cx(
                    'w-[18px] h-[18px] rounded-full flex items-center justify-center border',
                    active ? 'bg-accent border-accent text-canvas' : 'border-line-strong'
                  )}
                >
                  {active && <Check className="w-3 h-3" strokeWidth={3} />}
                </span>
              </div>
              <p className="text-[14px] font-semibold mt-3">{b.name}</p>
              <p className="text-[12px] text-ink-faint mt-0.5">{b.blurb}</p>
            </button>
          );
        })}
      </div>

      <Card className="p-5 mt-4">
        <form onSubmit={handleConnect} className="space-y-4">
          {broker.fields.map((field) => (
            <Field key={field.key} label={field.label} help={field.help}>
              <input
                id={`broker-${field.key}`}
                type={field.type}
                required
                autoComplete="off"
                placeholder={field.placeholder}
                className={cx('field', field.key !== 'password' && 'tnum')}
                value={values[field.key] || ''}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
              />
            </Field>
          ))}

          {error && <Notice tone="error">{error}</Notice>}

          <Button type="submit" block loading={connecting}>
            {connecting ? 'Verifying with your broker' : `Connect ${broker.name} account`}
          </Button>

          {connecting && (
            <p className="text-[12px] text-ink-faint text-center leading-relaxed">
              This takes up to a minute — we start a terminal and wait for {broker.name} to
              accept the login before saving anything.
            </p>
          )}
        </form>
      </Card>

      <div className="mt-4 card-quiet p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-ink-soft shrink-0 mt-0.5" />
        <div className="text-[12.5px] text-ink-soft leading-relaxed space-y-1.5">
          <p>
            Your password is encrypted before it is stored and is only ever used to log the
            trading terminal into {broker.name}. It is never sent back to this browser.
          </p>
          <p>
            Not ready for real money? Open an MT5 <strong>demo</strong> account with{' '}
            {broker.name} and connect that instead — it works exactly the same way.
          </p>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </dt>
      <dd className="tnum text-[14px] mt-0.5">{value}</dd>
    </div>
  );
}
