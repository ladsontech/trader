import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';
import { PLANS, getPlanPrice, planById } from '../lib/constants';
import { checkPayment, initiateSubscription, apiErrorMessage } from '../lib/api';
import { formatLocalMoney, remainingLabel, renewalDate } from '../lib/format';
import { Button, Card, Field, Notice, cx } from '../components/ui';
import { ArrowRight, Check, CheckCircle2, Crown, Smartphone, Sparkles, XCircle, Zap } from 'lucide-react';

type TxState = 'idle' | 'waiting' | 'completed' | 'failed';

const pendingKey = (uid: string) => `tradebot.pendingPayment.${uid}`;

export default function Subscribe() {
  const { user, userData, isSubscribed, country, currency, setCountry } = useAuth();
  const [selected, setSelected] = useState<'standard' | 'premium'>('premium');
  const [phone, setPhone] = useState(userData?.phoneDigits || '');
  const [state, setState] = useState<TxState>('idle');
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const plan = PLANS.find((p) => p.id === selected)!;
  const isKenya = country === 'KE';
  const planPrice = getPlanPrice(plan, currency);

  /* Restore a prompt the user walked away from. */
  useEffect(() => {
    if (!user || reference) return;
    const saved = localStorage.getItem(pendingKey(user.uid));
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { reference?: string; planId?: 'standard' | 'premium' };
      if (!parsed.reference) throw new Error('empty');
      setReference(parsed.reference);
      if (parsed.planId) setSelected(parsed.planId);
      setState('waiting');
    } catch {
      localStorage.removeItem(pendingKey(user.uid));
    }
  }, [user, reference]);

  const settle = useCallback(
    (status: 'completed' | 'failed', reason?: string | null) => {
      if (user) localStorage.removeItem(pendingKey(user.uid));
      setState(status);
      if (status === 'failed') {
        setError(reason || 'The payment did not go through.');
      }
    },
    [user]
  );

  /* Live status straight from our own ledger — written only by the server. */
  useEffect(() => {
    if (!reference || state !== 'waiting') return;
    const unsubscribe = onSnapshot(
      doc(db, 'tradebot_transactions', reference),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.status === 'completed') settle('completed');
        else if (data.status === 'failed') settle('failed', data.failureReason);
      },
      () => setNotice('Live updates paused — we are still checking your payment.')
    );
    return () => unsubscribe();
  }, [reference, state, settle]);

  /* Backstop poll in case the provider callback is late or the listener is blocked. */
  useEffect(() => {
    if (!reference || state !== 'waiting') return;
    const timer = setInterval(async () => {
      try {
        const result = await checkPayment(reference);
        if (result.status === 'completed') settle('completed');
        else if (result.status === 'failed') settle('failed', result.failureReason);
      } catch {
        /* keep waiting */
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [reference, state, settle]);

  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || state === 'waiting') return;

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 9) {
      setError(
        isKenya
          ? 'Enter the M-Pesa number to charge, for example 0712345678.'
          : 'Enter the mobile money number to charge, for example 0770123456.'
      );
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const result = await initiateSubscription(plan.id, digits, country);
      if (user) {
        localStorage.setItem(
          pendingKey(user.uid),
          JSON.stringify({ reference: result.reference, planId: plan.id })
        );
      }
      setReference(result.reference);
      setState('waiting');
      if (result.reused && result.message) setNotice(result.message);
    } catch (err) {
      setState('failed');
      setError(
        apiErrorMessage(err, 'We could not send the payment prompt. Please try again.')
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const reset = () => {
    if (user) localStorage.removeItem(pendingKey(user.uid));
    setState('idle');
    setReference(null);
    setError('');
    setNotice('');
  };

  /* ── Already subscribed ─────────────────────────────────────── */
  if (isSubscribed && state !== 'completed') {
    const active = planById(userData?.subscriptionPlan);
    return (
      <div className="max-w-2xl">
        <header className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">Your plan</h1>
          <p className="text-xs sm:text-sm text-ink-soft mt-1">
            Renewals stack onto the time you have left, so paying early never costs you a day.
          </p>
        </header>

        <Card className="p-5">
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

          <div className="divider my-4" />

          <Link to="/broker" className="btn btn-ghost w-full">
            Manage broker connection
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Card>

        <div className="mt-8">
          <p className="text-[13px] text-ink-soft mb-3">Renew or change plan</p>
          <PlanCards
            selected={selected}
            onSelect={setSelected}
            currency={currency}
            locked={false}
          />
          <div className="mt-5">
            <PayForm
              phone={phone}
              setPhone={setPhone}
              amount={planPrice}
              currency={currency}
              country={country}
              onSubmit={pay}
              submitting={submitting}
              disabled={false}
            />
          </div>
          {error && (
            <div className="mt-3">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Payment succeeded ──────────────────────────────────────── */
  if (state === 'completed') {
    return (
      <div className="max-w-md">
        <Card className="p-6 text-center fade-up">
          <div className="w-11 h-11 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-[17px] font-semibold">Payment received</h2>
          <p className="text-[13px] text-ink-soft mt-1.5 leading-relaxed">
            Your {plan.name} plan is active for a full year. One more step:
            connect the broker account the bot should trade on.
          </p>
          <Link to="/broker" className="btn btn-primary w-full mt-5">
            Connect my broker
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Card>
      </div>
    );
  }

  /* ── Choose and pay ─────────────────────────────────────────── */
  return (
    <div className="max-w-2xl fade-up">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          Choose your plan
        </h1>
        <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto leading-relaxed">
          {isKenya
            ? 'One payment covers a full year via Safaricom M-Pesa. The bot starts as soon as you connect your broker.'
            : 'One payment covers a full year via MTN or Airtel Mobile Money. The bot starts as soon as you connect your broker.'}
        </p>

        {/* Region Switcher */}
        <div className="flex items-center justify-center gap-1 mt-4">
          <div className="flex items-center gap-1 bg-surface border border-line p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setCountry('UG')}
              className={cx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
                country === 'UG'
                  ? 'bg-raised text-ink border border-line-strong shadow-xs'
                  : 'text-ink-faint hover:text-ink-soft'
              )}
            >
              <span>🇺🇬</span> UGX
            </button>
            <button
              type="button"
              onClick={() => setCountry('KE')}
              className={cx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer',
                country === 'KE'
                  ? 'bg-raised text-ink border border-line-strong shadow-xs'
                  : 'text-ink-faint hover:text-ink-soft'
              )}
            >
              <span>🇰🇪</span> KES
            </button>
          </div>
        </div>
      </div>

      {/* Plan cards */}
      <PlanCards
        selected={selected}
        onSelect={setSelected}
        currency={currency}
        locked={state === 'waiting'}
      />

      {/* Payment area */}
      <div className="mt-6 space-y-3">
        {state === 'waiting' && (
          <Notice tone="warn" title="Check your phone">
            {isKenya
              ? `Approve the ${formatLocalMoney(planPrice, currency)} M-Pesa STK prompt on your Safaricom handset. This page updates itself the moment it clears.`
              : `Approve the ${formatLocalMoney(planPrice, currency)} request with your Mobile Money PIN. This page updates itself the moment it clears.`}
          </Notice>
        )}

        {notice && <Notice tone="info">{notice}</Notice>}

        {state === 'failed' && error && (
          <Notice tone="error" title="Payment not completed">
            <p>{error}</p>
            <button onClick={reset} className="mt-1.5 font-semibold underline cursor-pointer">
              Try again
            </button>
          </Notice>
        )}

        {state !== 'failed' && error && <Notice tone="error">{error}</Notice>}

        {state !== 'failed' && (
          <PayForm
            phone={phone}
            setPhone={setPhone}
            amount={planPrice}
            currency={currency}
            country={country}
            onSubmit={pay}
            submitting={submitting}
            disabled={state === 'waiting'}
          />
        )}
      </div>

      <p className="mt-6 text-[11px] text-ink-faint leading-relaxed text-center">
        Payments are collected securely via Mobile Money & M-Pesa. Your subscription is
        activated by our automated payment server once the provider confirms the transaction.
      </p>
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────────── */

function PlanCards({
  selected,
  onSelect,
  currency,
  locked,
}: {
  selected: string;
  onSelect: (id: 'standard' | 'premium') => void;
  currency: 'UGX' | 'KES';
  locked: boolean;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {PLANS.map((p) => {
        const active = selected === p.id;
        const price = getPlanPrice(p, currency);
        const isPremium = p.recommended;

        return (
          <button
            key={p.id}
            type="button"
            disabled={locked}
            onClick={() => onSelect(p.id)}
            className={cx(
              'plan-card group relative text-center p-5 pt-6 rounded-[18px] border-2 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed',
              active
                ? isPremium
                  ? 'border-accent bg-accent/[0.05] shadow-[0_0_24px_-4px_rgba(45,212,167,0.2)]'
                  : 'border-accent/60 bg-accent/[0.03]'
                : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2'
            )}
          >
            {/* Popular badge */}
            {isPremium && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent text-[11px] font-bold uppercase tracking-wider text-[#06231b] shadow-md">
                  <Crown className="w-3 h-3" />
                  Popular
                </span>
              </div>
            )}

            {/* Plan icon */}
            <div className={cx(
              'w-10 h-10 rounded-[12px] flex items-center justify-center mx-auto mb-3',
              active
                ? 'bg-accent/15 text-accent'
                : 'bg-surface-2 border border-line text-ink-faint'
            )}>
              {isPremium ? <Sparkles className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
            </div>

            {/* Plan name */}
            <h3 className="text-[16px] font-bold text-ink">{p.name}</h3>

            {/* Price */}
            <p className="mt-3 mb-1">
              <span className="tnum text-[28px] font-extrabold text-ink leading-none">
                {formatLocalMoney(price, currency)}
              </span>
            </p>
            <span className="text-[12px] text-ink-faint font-medium">/ year</span>

            {/* Tagline */}
            <p className="text-[12px] text-ink-soft mt-3 leading-relaxed px-2">
              {p.tagline}
            </p>

            {/* Divider */}
            <div className="w-10 h-px bg-line mx-auto my-4" />

            {/* Features */}
            <ul className="space-y-2.5 text-left">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[12.5px] text-ink-soft">
                  <span className={cx(
                    'w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    active ? 'bg-accent/15 text-accent' : 'bg-surface-3 text-ink-faint'
                  )}>
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {/* Select button */}
            <div className={cx(
              'mt-5 py-2.5 rounded-[10px] text-[13px] font-semibold transition-all duration-200',
              active
                ? 'bg-accent text-[#06231b]'
                : 'bg-surface-2 border border-line text-ink-soft group-hover:border-line-strong'
            )}>
              {active ? (
                <span className="flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                </span>
              ) : (
                `Get ${p.name}`
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PayForm({
  phone,
  setPhone,
  amount,
  currency,
  country,
  onSubmit,
  submitting,
  disabled,
}: {
  phone: string;
  setPhone: (v: string) => void;
  amount: number;
  currency: 'UGX' | 'KES';
  country: 'UG' | 'KE';
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  disabled: boolean;
}) {
  const isKenya = country === 'KE';
  const dialCode = isKenya ? '+254' : '+256';

  return (
    <Card className="p-4">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label={isKenya ? 'M-Pesa phone number' : 'Mobile Money number'}
          help={
            isKenya
              ? 'Safaricom M-Pesa or Airtel Money. An STK PIN prompt goes to this handset.'
              : 'MTN or Airtel Uganda. The PIN prompt goes to this number.'
          }
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint tnum pointer-events-none border-r border-line pr-2.5">
              {dialCode}
            </span>
            <input
              id="subscribe-phone"
              type="tel"
              inputMode="numeric"
              required
              disabled={disabled}
              placeholder={isKenya ? '712 345 678 or 140 123 456' : '770 123 456'}
              className="field tnum pl-[74px]"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </Field>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[13px] text-ink-soft">Total today</span>
          <span className="tnum text-[15px] font-semibold text-ink">
            {formatLocalMoney(amount, currency)}
          </span>
        </div>

        <Button
          id="subscribe-submit"
          type="submit"
          block
          loading={submitting}
          disabled={disabled}
        >
          {disabled ? (
            <>
              <XCircle className="w-4 h-4" />
              Waiting for your PIN
            </>
          ) : (
            <>
              <Smartphone className="w-4 h-4" />
              {isKenya ? 'Send M-Pesa STK Prompt' : 'Send payment request'}
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}
