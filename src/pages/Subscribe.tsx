import { Link, Navigate } from 'react-router';
import { useAuth } from '../lib/auth-context';
import { PLANS, getPlanPrice, planById } from '../lib/constants';
import { formatLocalMoney, remainingLabel, renewalDate, usd } from '../lib/format';
import { Card, cx } from '../components/ui';
import { pendingKey } from './Checkout';
import { ArrowRight, Check, CheckCircle2, Crown } from 'lucide-react';

export default function Subscribe() {
  const { user, userData, isSubscribed, currency } = useAuth();

  // A payment prompt is still open: take them straight back to it.
  let hasPending = false;
  try {
    hasPending = Boolean(user && localStorage.getItem(pendingKey(user.uid)));
  } catch {
    /* storage blocked */
  }
  if (hasPending) return <Navigate to="/checkout" replace />;

  const active = isSubscribed ? planById(userData?.subscriptionPlan) : undefined;

  return (
    <div className="max-w-2xl mx-auto fade-up">
      {isSubscribed ? (
        <>
          <header className="mb-5">
            <h1 className="text-2xl font-bold tracking-tight">Your plan</h1>
            <p className="text-sm text-ink-soft mt-1">
              Renewals add a year on top of the time you have left.
            </p>
          </header>
          <Card className="p-5 mb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <h2 className="text-[15px] font-semibold">{active?.name ?? 'Active'} plan</h2>
                </div>
                <p className="text-[13px] text-ink-soft mt-1">{active?.pairs}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[13px] font-semibold text-accent">
                  {remainingLabel(userData?.subscriptionExpiresAt)}
                </p>
                <p className="text-[11px] text-ink-faint mt-0.5">
                  until {renewalDate(userData?.subscriptionExpiresAt)}
                </p>
              </div>
            </div>
          </Card>
          <p className="text-[13px] font-semibold text-ink-soft mb-3">Renew or change plan</p>
        </>
      ) : (
        <header className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Choose your plan</h1>
          <p className="text-sm text-ink-soft mt-1.5 max-w-md leading-relaxed">
            One payment covers a full year. Pay with mobile money, connect your broker, and the
            bot starts trading.
          </p>
        </header>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {PLANS.map((p) => (
          <Card
            key={p.id}
            className={cx('p-5 flex flex-col', p.recommended && 'border-2 border-accent!')}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-bold">{p.name}</h2>
              {p.recommended && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[10px] font-bold uppercase tracking-wider text-white">
                  <Crown className="w-2.5 h-2.5" />
                  Popular
                </span>
              )}
            </div>
            <p className="text-[12.5px] text-ink-soft mt-0.5">{p.tagline}</p>

            <p className="mt-4 flex items-baseline gap-1">
              <span className="tnum text-[32px] font-bold leading-none">{usd(p.priceUsd)}</span>
              <span className="text-[13px] text-ink-faint">/ year</span>
            </p>
            <p className="text-[12px] text-ink-faint mt-1 tnum">
              ≈ {formatLocalMoney(getPlanPrice(p, currency), currency)}
            </p>

            <ul className="mt-4 space-y-2 flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-ink-soft">
                  <Check className="w-4 h-4 shrink-0 mt-0.5 text-accent" strokeWidth={2.5} />
                  {f}
                </li>
              ))}
            </ul>

            <Link
              to={`/checkout?plan=${p.id}`}
              className={cx('btn w-full mt-5', p.recommended ? 'btn-primary' : 'btn-ghost')}
            >
              {active?.id === p.id ? `Renew ${p.name}` : `Choose ${p.name}`}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-[11.5px] text-ink-faint leading-relaxed text-center">
        Prices in US dollars. You pay the equivalent in Uganda shillings (or Kenya shillings from a
        +254 number) by mobile money.
      </p>
    </div>
  );
}
