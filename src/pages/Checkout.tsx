import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';
import { getPlanPrice, planById, type PlanId } from '../lib/constants';
import { apiErrorMessage, cancelPayment, checkPayment, initiateSubscription } from '../lib/api';
import { formatLocalMoney, usd } from '../lib/format';
import { DEFAULT_DIAL, PAYMENT_DIALS, parsePhone, splitStoredPhone } from '../lib/phone';
import { Button, Card, Field, Notice } from '../components/ui';
import { PhoneInput } from '../components/PhoneInput';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, Lock, Smartphone, XCircle } from 'lucide-react';

type TxState = 'idle' | 'waiting' | 'completed' | 'failed';

export const pendingKey = (uid: string) => `tradebot.pendingPayment.${uid}`;

interface Pending {
  reference: string;
  planId?: PlanId;
  phone?: string;
  dial?: string;
}

function readPending(uid?: string): Pending | null {
  if (!uid) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(pendingKey(uid)) || 'null') as Pending | null;
    return parsed?.reference ? parsed : null;
  } catch {
    return null;
  }
}

export default function Checkout() {
  const { user, userData } = useAuth();
  const [params] = useSearchParams();

  // A prompt the user walked away from wins over the URL.
  const [pending] = useState(() => readPending(user?.uid));
  const plan = planById(pending?.planId ?? params.get('plan'));

  const stored = splitStoredPhone(userData?.phoneDigits, userData?.country);
  const storedIsPayable = PAYMENT_DIALS.includes(stored.dial);
  const [dial, setDial] = useState(pending?.dial ?? (storedIsPayable ? stored.dial : DEFAULT_DIAL));
  const [phone, setPhone] = useState(pending?.phone ?? (storedIsPayable ? stored.number : ''));

  const [state, setState] = useState<TxState>(pending ? 'waiting' : 'idle');
  const [reference, setReference] = useState<string | null>(pending?.reference ?? null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const submittingRef = useRef(false);

  const country: 'UG' | 'KE' = dial === '254' ? 'KE' : 'UG';
  const currency: 'UGX' | 'KES' = country === 'KE' ? 'KES' : 'UGX';
  const payable = PAYMENT_DIALS.includes(dial);

  const settle = useCallback(
    (status: 'completed' | 'failed', reason?: string | null) => {
      if (user) localStorage.removeItem(pendingKey(user.uid));
      setState(status);
      if (status === 'failed') setError(reason || 'The payment did not go through.');
    },
    [user]
  );

  /* Live status straight from our own ledger — written only by the server. */
  useEffect(() => {
    if (!reference || state !== 'waiting') return;
    return onSnapshot(
      doc(db, 'tradebot_transactions', reference),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.status === 'completed') settle('completed');
        else if (data.status === 'failed') settle('failed', data.failureReason);
      },
      () => setNotice('Live updates paused — we are still checking your payment.')
    );
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

  if (!plan) return <Navigate to="/subscribe" replace />;

  const amount = getPlanPrice(plan, currency);
  const localAmount = formatLocalMoney(amount, currency);

  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || state === 'waiting') return;

    const parsed = parsePhone(dial, phone);
    if (!PAYMENT_DIALS.includes(parsed.dial)) {
      setError('Mobile money works with Uganda (+256) or Kenya (+254) numbers. Change the code to one of these.');
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
          JSON.stringify({ reference: result.reference, planId: plan.id, phone, dial })
        );
      }
      setReference(result.reference);
      setState('waiting');
      if (result.reused && result.message) setNotice(result.message);
    } catch (err) {
      setState('failed');
      setError(apiErrorMessage(err, 'We could not send the payment prompt. Please try again.'));
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

  /* ── Waiting for PIN ────────────────────────────────────────── */
  if (state === 'waiting') {
    return (
      <div className="max-w-md mx-auto fade-up">
        <Card className="p-6 sm:p-7 text-center">
          <div className="w-12 h-12 rounded-full bg-accent-soft flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
          <h1 className="text-[19px] font-bold text-ink">Waiting for your PIN</h1>
          <div className="mt-4 p-3.5 rounded-xl bg-surface-2 border border-line">
            <p className="text-[15px] font-semibold text-ink tnum">{localAmount}</p>
            <p className="text-[12.5px] text-ink-soft mt-0.5 tnum">to {parsePhone(dial, phone).international}</p>
          </div>
          <p className="text-[13px] text-ink-soft mt-4 leading-relaxed">
            Check your phone and enter your mobile money PIN. This page updates by itself once the
            payment is received.
          </p>
          {notice && (
            <div className="mt-3 text-left">
              <Notice tone="info">{notice}</Notice>
            </div>
          )}
          <Button type="button" variant="ghost" block onClick={cancelWait} loading={cancelling} className="mt-5">
            <XCircle className="w-4 h-4" />
            Cancel payment
          </Button>
          <p className="text-[11.5px] text-ink-faint mt-2.5">
            Cancelling here does not charge you. Just ignore the prompt on your phone.
          </p>
        </Card>
      </div>
    );
  }

  /* ── Paid ───────────────────────────────────────────────────── */
  if (state === 'completed') {
    return (
      <div className="max-w-md mx-auto">
        <Card className="p-6 text-center fade-up">
          <div className="w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h1 className="text-[19px] font-bold">Payment received</h1>
          <p className="text-[13.5px] text-ink-soft mt-1.5 leading-relaxed">
            Your {plan.name} plan is active for a full year. Last step: connect the broker account
            the bot should trade on.
          </p>
          <Link to="/broker" className="btn btn-primary w-full mt-5">
            Connect my broker
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Card>
      </div>
    );
  }

  /* ── Checkout ───────────────────────────────────────────────── */
  return (
    <div className="max-w-md mx-auto fade-up">
      <Link
        to="/subscribe"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft hover:text-ink mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Change plan
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Checkout</h1>

      {/* Order summary */}
      <Card className="p-5 mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">Your plan</p>
        <div className="flex items-start justify-between gap-4 mt-2">
          <div>
            <h2 className="text-[17px] font-bold">{plan.name}</h2>
            <p className="text-[12.5px] text-ink-soft mt-0.5">{plan.pairs}</p>
          </div>
          <p className="text-right shrink-0">
            <span className="tnum text-[20px] font-bold">{usd(plan.priceUsd)}</span>
            <span className="block text-[11.5px] text-ink-faint">per year</span>
          </p>
        </div>
        <ul className="mt-4 space-y-1.5">
          {plan.features.slice(0, 3).map((f) => (
            <li key={f} className="flex items-start gap-2 text-[12.5px] text-ink-soft">
              <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-accent" strokeWidth={3} />
              {f}
            </li>
          ))}
        </ul>
        <div className="divider my-4" />
        <div className="flex items-center justify-between">
          <span className="text-[13.5px] text-ink-soft">You pay today</span>
          <span className="tnum text-[16px] font-bold">{payable ? localAmount : usd(plan.priceUsd)}</span>
        </div>
        {payable && (
          <p className="text-[11.5px] text-ink-faint mt-1 text-right">
            {usd(plan.priceUsd)} converted to {currency}
          </p>
        )}
      </Card>

      {/* Payment */}
      <Card className="p-5 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-4 h-4 text-accent" />
          <h2 className="text-[15px] font-semibold">Pay with mobile money</h2>
        </div>

        <form onSubmit={pay} className="space-y-4" noValidate>
          <Field
            label="Mobile money number"
            help={
              dial === '254'
                ? 'Safaricom M-Pesa or Airtel Kenya. A PIN prompt is sent to this phone.'
                : dial === '256'
                  ? 'MTN or Airtel Uganda. A PIN prompt is sent to this phone.'
                  : 'Mobile money works with Uganda (+256) and Kenya (+254) numbers.'
            }
          >
            <PhoneInput id="checkout-phone" dial={dial} onDialChange={setDial} value={phone} onChange={setPhone} />
          </Field>

          {notice && <Notice tone="info">{notice}</Notice>}
          {error && (
            <Notice tone="error" title={state === 'failed' ? 'Payment not completed' : undefined}>
              {error}
            </Notice>
          )}

          <Button id="checkout-pay" type="submit" block loading={submitting} className="py-3 text-[15px]">
            {payable ? `Pay ${localAmount}` : 'Pay now'}
          </Button>
        </form>

        <p className="mt-4 text-[11.5px] text-ink-faint flex items-start gap-1.5 leading-relaxed">
          <Lock className="w-3.5 h-3.5 shrink-0 mt-px" />
          Processed by Marz Pay. Your plan activates automatically once the payment is confirmed.
        </p>
      </Card>
    </div>
  );
}
