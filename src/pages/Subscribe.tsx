import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';
import { PLANS, getPlanPrice, planById } from '../lib/constants';
import { checkPayment, initiateSubscription, cancelPayment, apiErrorMessage } from '../lib/api';
import { formatLocalMoney, remainingLabel, renewalDate } from '../lib/format';
import { PAYMENT_DIALS, parsePhone, splitStoredPhone } from '../lib/phone';
import { Button, Card, Field, Notice, cx } from '../components/ui';
import { PhoneInput } from '../components/PhoneInput';
import { ArrowRight, Check, CheckCircle2, Crown, Loader2, Smartphone, XCircle } from 'lucide-react';

type TxState = 'idle' | 'waiting' | 'completed' | 'failed';

const pendingKey = (uid: string) => `tradebot.pendingPayment.${uid}`;

export default function Subscribe() {
  const { user, userData, isSubscribed } = useAuth();
  const [selected, setSelected] = useState<'standard' | 'premium'>('premium');
  // Pre-fill the number they signed up with when it can receive a mobile
  // money prompt; otherwise start from +256 with an empty box.
  const [payDial, setPayDial] = useState(() => {
    const stored = splitStoredPhone(userData?.phoneDigits, userData?.country);
    return PAYMENT_DIALS.includes(stored.dial) ? stored.dial : '256';
  });
  const [phone, setPhone] = useState(() => {
    const stored = splitStoredPhone(userData?.phoneDigits, userData?.country);
    return PAYMENT_DIALS.includes(stored.dial) ? stored.number : '';
  });
  const [state, setState] = useState<TxState>('idle');
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const submittingRef = useRef(false);

  const plan = PLANS.find((p) => p.id === selected)!;
  const country: 'UG' | 'KE' = payDial === '254' ? 'KE' : 'UG';
  const currency: 'UGX' | 'KES' = country === 'KE' ? 'KES' : 'UGX';
  const isKenya = country === 'KE';
  const planPrice = getPlanPrice(plan, currency);

  /* Restore a prompt the user walked away from. */
  useEffect(() => {
    if (!user || reference) return;
    const saved = localStorage.getItem(pendingKey(user.uid));
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        reference?: string;
        planId?: 'standard' | 'premium';
        phone?: string;
        dial?: string;
      };
      if (!parsed.reference) throw new Error('empty');
      setReference(parsed.reference);
      if (parsed.planId) setSelected(parsed.planId);
      if (parsed.dial) setPayDial(parsed.dial);
      if (parsed.phone) setPhone(parsed.phone);
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

    const parsed = parsePhone(payDial, phone);
    if (!PAYMENT_DIALS.includes(parsed.dial)) {
      setError('Mobile money payments work with Uganda (+256) or Kenya (+254) numbers.');
      return;
    }
    if (!parsed.ok) {
      setError(parsed.error || 'Enter the mobile money number to charge.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const result = await initiateSubscription(plan.id, parsed.international, country);
      if (user) {
        localStorage.setItem(
          pendingKey(user.uid),
          JSON.stringify({ reference: result.reference, planId: plan.id, phone, dial: payDial })
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

  const cancelWait = async () => {
    setCancelling(true);
    const ref = reference;
    if (user) localStorage.removeItem(pendingKey(user.uid));
    setReference(null);
    setState('idle');
    setNotice('Payment cancelled');
    setError('');
    try {
      if (ref) await cancelPayment(ref);
    } catch (err) {
      console.warn('Failed to notify server of cancellation:', err);
    } finally {
      setCancelling(false);
    }
  };

  const reset = () => {
    if (user) localStorage.removeItem(pendingKey(user.uid));
    setState('idle');
    setReference(null);
    setError('');
    setNotice('');
  };

  /* ── Waiting for PIN ────────────────────────────────────────── */
  if (state === 'waiting') {
    const formattedAmount = formatLocalMoney(planPrice, currency);
    const displayPhone = parsePhone(payDial, phone).international;

    return (
      <div className="max-w-md mx-auto fade-up">
        <Card className="p-6 sm:p-7 text-center border-accent/30 shadow-lg shadow-accent/5">
          <div className="w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>

          <h2 className="text-[18px] font-bold text-ink">Waiting for your PIN</h2>

          <div className="mt-3.5 p-3.5 rounded-xl bg-surface-2 border border-line">
            <p className="text-[14px] font-semibold text-accent tnum">
              {formattedAmount} to {displayPhone}
            </p>
            <p className="text-[12px] text-ink-soft mt-1 leading-snug">
              {isKenya
                ? 'Approve the Safaricom M-Pesa prompt on your phone.'
                : 'Approve the prompt with your Mobile Money PIN on your phone.'}
            </p>
          </div>

          <p className="text-[12.5px] text-ink-soft mt-4 leading-relaxed">
            This page updates by itself once your payment is received.
          </p>

          <p className="text-[11.5px] text-ink-faint mt-2.5 leading-relaxed bg-surface/60 p-2.5 rounded-lg border border-line/60">
            To stop this payment, tap Cancel payment below and simply close the prompt on your phone without entering your PIN.
          </p>

          <div className="mt-5">
            <Button
              type="button"
              variant="ghost"
              block
              onClick={cancelWait}
              loading={cancelling}
              className="border border-line hover:border-line-strong cursor-pointer"
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              Cancel payment
            </Button>
          </div>
        </Card>
      </div>
    );
  }

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
              dial={payDial}
              setDial={setPayDial}
              amount={planPrice}
              currency={currency}
              country={country}
              onSubmit={pay}
              submitting={submitting}
              disabled={false}
            />
          </div>
          {notice && (
            <div className="mt-3">
              <Notice tone="info">{notice}</Notice>
            </div>
          )}
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
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
          Choose your plan
        </h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-md leading-relaxed">
          One payment covers a full year. Pay with mobile money, then connect your broker and
          the bot starts trading.
        </p>

      </div>

      {/* Plan cards */}
      <PlanCards
        selected={selected}
        onSelect={setSelected}
        currency={currency}
        locked={false}
      />

      {/* Payment area */}
      <div className="mt-6 space-y-3">
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
            dial={payDial}
            setDial={setPayDial}
            amount={planPrice}
            currency={currency}
            country={country}
            onSubmit={pay}
            submitting={submitting}
            disabled={false}
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
    <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Plan">
      {PLANS.map((p) => {
        const active = selected === p.id;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${p.name} plan`}
            disabled={locked}
            onClick={() => onSelect(p.id)}
            className={cx(
              'plan-card relative text-left p-4 rounded-[16px] border-2 transition-all cursor-pointer disabled:cursor-not-allowed',
              active ? 'border-accent bg-accent/[0.04]' : 'border-line bg-surface hover:border-line-strong'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-bold text-ink">{p.name}</h3>
                  {p.recommended && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[10px] font-bold uppercase tracking-wider text-white">
                      <Crown className="w-2.5 h-2.5" />
                      Popular
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-ink-soft mt-0.5">{p.tagline}</p>
              </div>
              <span
                className={cx(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5',
                  active ? 'border-accent bg-accent text-white' : 'border-line-strong'
                )}
              >
                {active && <Check className="w-3 h-3" strokeWidth={3} />}
              </span>
            </div>

            <p className="mt-3">
              <span className="tnum text-[22px] font-bold text-ink">
                {formatLocalMoney(getPlanPrice(p, currency), currency)}
              </span>
              <span className="text-[12px] text-ink-faint font-medium"> / year</span>
            </p>

            <ul className="mt-3 space-y-1.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[12.5px] text-ink-soft">
                  <Check
                    className={cx('w-3.5 h-3.5 shrink-0 mt-0.5', active ? 'text-accent' : 'text-ink-faint')}
                    strokeWidth={3}
                  />
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
  dial,
  setDial,
  amount,
  currency,
  country,
  onSubmit,
  submitting,
  disabled,
}: {
  phone: string;
  setPhone: (v: string) => void;
  dial: string;
  setDial: (v: string) => void;
  amount: number;
  currency: 'UGX' | 'KES';
  country: 'UG' | 'KE';
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  disabled: boolean;
}) {
  const isKenya = country === 'KE';

  return (
    <Card className="p-4">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label={isKenya ? 'M-Pesa phone number' : 'Mobile Money number'}
          help={
            isKenya
              ? 'Safaricom M-Pesa or Airtel Kenya. A PIN prompt is sent to this phone.'
              : 'MTN or Airtel Uganda. A PIN prompt is sent to this phone. Paying from Kenya? Switch the code to +254.'
          }
        >
          <PhoneInput
            id="subscribe-phone"
            dial={dial}
            onDialChange={setDial}
            value={phone}
            onChange={setPhone}
            disabled={disabled}
            only={PAYMENT_DIALS}
          />
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
