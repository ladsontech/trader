import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';
import { PLANS, planById } from '../lib/constants';
import { checkPayment, initiateSubscription, apiErrorMessage } from '../lib/api';
import { daysLeft, ugx } from '../lib/format';
import { Button, Card, Field, Notice, PageTitle, cx } from '../components/ui';
import { ArrowRight, Check, CheckCircle2, Smartphone, XCircle } from 'lucide-react';

type TxState = 'idle' | 'waiting' | 'completed' | 'failed';

const pendingKey = (uid: string) => `tradebot.pendingPayment.${uid}`;

export default function Subscribe() {
  const { user, userData, isSubscribed } = useAuth();
  const [selected, setSelected] = useState<'standard' | 'premium'>('premium');
  const [phone, setPhone] = useState(userData?.phoneDigits || '');
  const [state, setState] = useState<TxState>('idle');
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const plan = PLANS.find((p) => p.id === selected)!;

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
      setError('Enter the mobile money number to charge, for example 0770123456.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const result = await initiateSubscription(plan.id, digits);
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
    const remaining = daysLeft(userData?.subscriptionExpiresAt);
    return (
      <div className="max-w-2xl">
        <PageTitle
          title="Your plan"
          subtitle="Renewals stack onto the time you have left, so paying early never costs you days."
        />

        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-accent" />
                <h2 className="text-[15px] font-semibold">{active?.name ?? 'Active'} plan</h2>
              </div>
              <p className="text-[13px] text-ink-soft mt-1">{active?.pairs}</p>
            </div>
            <div className="text-right">
              <p className="tnum text-lg">{remaining}</p>
              <p className="text-[11px] text-ink-faint">
                {remaining === 1 ? 'day left' : 'days left'}
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
          <PlanGrid selected={selected} onSelect={setSelected} locked={false} />
          <div className="mt-4">
            <PayForm
              phone={phone}
              setPhone={setPhone}
              amount={plan.price}
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
            Your {plan.name} plan is active for {plan.durationDays} days. One more step:
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
    <div className="max-w-2xl">
      <PageTitle
        title="Choose your plan"
        subtitle="Pay once for 30 days by MTN or Airtel mobile money. The bot starts after you connect your broker."
      />

      <PlanGrid selected={selected} onSelect={setSelected} locked={state === 'waiting'} />

      <div className="mt-5 space-y-3">
        {state === 'waiting' && (
          <Notice tone="warn" title="Check your phone">
            Approve the {ugx(plan.price)} request with your mobile money PIN. This page
            updates itself the moment it clears — no need to refresh.
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
            amount={plan.price}
            onSubmit={pay}
            submitting={submitting}
            disabled={state === 'waiting'}
          />
        )}
      </div>

      <p className="mt-5 text-[11px] text-ink-faint leading-relaxed">
        Payments are collected through the Investio mobile money channel. Your subscription is
        activated by our payment server once the provider confirms the transaction.
      </p>
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────────── */

function PlanGrid({
  selected,
  onSelect,
  locked,
}: {
  selected: string;
  onSelect: (id: 'standard' | 'premium') => void;
  locked: boolean;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {PLANS.map((p) => {
        const active = selected === p.id;
        return (
          <button
            key={p.id}
            type="button"
            disabled={locked}
            onClick={() => onSelect(p.id)}
            className={cx(
              'text-left p-4 rounded-[14px] border transition-colors cursor-pointer disabled:cursor-not-allowed',
              active
                ? 'border-accent/50 bg-accent/[0.04]'
                : 'border-line bg-surface hover:border-line-strong'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold">{p.name}</h3>
                  {p.recommended && (
                    <span className="chip border-accent/30 text-accent">Most popular</span>
                  )}
                </div>
                <p className="text-[12px] text-ink-faint mt-0.5">{p.tagline}</p>
              </div>
              <span
                className={cx(
                  'w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center border',
                  active ? 'bg-accent border-accent text-canvas' : 'border-line-strong'
                )}
              >
                {active && <Check className="w-3 h-3" strokeWidth={3} />}
              </span>
            </div>

            <p className="tnum text-[22px] mt-3">
              {ugx(p.price)}
              <span className="font-sans text-[12px] text-ink-faint"> / 30 days</span>
            </p>

            <ul className="mt-3 space-y-1.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[12.5px] text-ink-soft">
                  <Check className="w-3 h-3 text-accent shrink-0 mt-1" strokeWidth={3} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
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
  onSubmit,
  submitting,
  disabled,
}: {
  phone: string;
  setPhone: (v: string) => void;
  amount: number;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  disabled: boolean;
}) {
  return (
    <Card className="p-4">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Mobile money number"
          help="MTN or Airtel. The PIN prompt goes to this number."
        >
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint tnum pointer-events-none border-r border-line pr-2.5">
              +256
            </span>
            <input
              id="subscribe-phone"
              type="tel"
              inputMode="numeric"
              required
              disabled={disabled}
              placeholder="770 123 456"
              className="field tnum pl-[74px]"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </Field>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[13px] text-ink-soft">Total today</span>
          <span className="tnum text-[15px] font-semibold">{ugx(amount)}</span>
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
              Send payment request
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}
