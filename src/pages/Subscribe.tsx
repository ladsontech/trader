import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';
import { PLANS, planById } from '../lib/constants';
import { checkPayment, initiateSubscription, cancelPayment, apiErrorMessage } from '../lib/api';
import { daysLeft, ugx } from '../lib/format';
import { Button, Card, Field, Notice, PageTitle, cx } from '../components/ui';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  XCircle,
} from 'lucide-react';

type TxState = 'idle' | 'waiting' | 'completed' | 'failed';

const pendingKey = (uid: string) => `tradebot.pendingPayment.${uid}`;
const TIMEOUT_SECONDS = 120; // 2 minutes auto-timeout for PIN entry

export default function Subscribe() {
  const { user, userData, isSubscribed } = useAuth();
  const [selected, setSelected] = useState<'standard' | 'premium'>('premium');
  const [phone, setPhone] = useState(userData?.phoneDigits || '');
  const [state, setState] = useState<TxState>('idle');
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_SECONDS);
  const submittingRef = useRef(false);

  const plan = PLANS.find((p) => p.id === selected)!;

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
        startedAt?: number;
      };
      if (!parsed.reference) throw new Error('empty');
      const elapsed = parsed.startedAt ? Math.floor((Date.now() - parsed.startedAt) / 1000) : 0;
      if (elapsed > TIMEOUT_SECONDS) {
        localStorage.removeItem(pendingKey(user.uid));
        return;
      }
      setReference(parsed.reference);
      if (parsed.planId) setSelected(parsed.planId);
      if (parsed.phone) setPhone(parsed.phone);
      setTimeLeft(Math.max(10, TIMEOUT_SECONDS - elapsed));
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

  /* Countdown timer when in waiting state */
  useEffect(() => {
    if (state !== 'waiting') return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (user) localStorage.removeItem(pendingKey(user.uid));
          cancelPayment(reference).catch(() => undefined);
          setState('idle');
          setNotice(
            'The payment request timed out. If you entered a wrong number or did not receive the prompt, verify your number and try again.'
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [state, reference, user]);

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
    }, 6000);
    return () => clearInterval(timer);
  }, [reference, state, settle]);

  const pay = async (event?: React.FormEvent, forceNew = false) => {
    if (event) event.preventDefault();
    if (submittingRef.current || (state === 'waiting' && !forceNew)) return;

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
      const result = await initiateSubscription(plan.id, digits, forceNew);
      if (user) {
        localStorage.setItem(
          pendingKey(user.uid),
          JSON.stringify({
            reference: result.reference,
            planId: plan.id,
            phone: digits,
            startedAt: Date.now(),
          })
        );
      }
      setReference(result.reference);
      setTimeLeft(TIMEOUT_SECONDS);
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

  const handleCancel = async () => {
    setCancelling(true);
    const refToCancel = reference;
    if (user) localStorage.removeItem(pendingKey(user.uid));
    setState('idle');
    setReference(null);
    setError('');
    setNotice('Payment request cancelled. You can change your number or package and try again.');
    try {
      await cancelPayment(refToCancel);
    } catch {
      /* ignore background cancel error */
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

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  /* ── Already subscribed ─────────────────────────────────────── */
  if (isSubscribed && state !== 'completed') {
    const active = planById(userData?.subscriptionPlan);
    const remaining = daysLeft(userData?.subscriptionExpiresAt);
    return (
      <div className="max-w-2xl space-y-6">
        <PageTitle
          title="Your annual subscription"
          subtitle="Annual renewals stack seamlessly onto your remaining days, so renewing early never costs you time."
        />

        <Card className="p-5 border-accent/20 bg-surface/80">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                <h2 className="text-[16px] font-semibold">{active?.name ?? 'Active'} Annual Plan</h2>
              </div>
              <p className="text-[13px] text-ink-soft mt-1">{active?.pairs}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="chip border-accent/30 text-accent text-[11px]">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Active 365-Day License
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="tnum text-2xl font-bold text-accent">{remaining}</p>
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
          <p className="text-[13px] font-medium text-ink-soft mb-3">Renew or switch annual plan</p>
          <PlanGrid selected={selected} onSelect={setSelected} locked={state === 'waiting'} />
          
          <div className="mt-4">
            <PayForm
              phone={phone}
              setPhone={setPhone}
              amount={plan.price}
              planName={plan.name}
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
      <div className="max-w-md mx-auto">
        <Card className="p-6 text-center fade-up border-accent/30 shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto mb-4 border border-accent/30">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <span className="chip border-accent/30 text-accent text-[11px] mb-2">
            Annual License Activated
          </span>
          <h2 className="text-[19px] font-semibold mt-1">Payment Received!</h2>
          <p className="text-[13.5px] text-ink-soft mt-2 leading-relaxed">
            Your <strong className="text-ink">{plan.name}</strong> annual subscription is now active for{' '}
            <strong className="text-accent">{plan.durationDays} days (1 year)</strong>.
          </p>
          <p className="text-[12.5px] text-ink-faint mt-2">
            One final step: connect your Exness or FBS MT5 broker account to activate trading.
          </p>
          <Link to="/broker" className="btn btn-primary w-full mt-6 py-3 font-semibold shadow-lg">
            Connect my broker
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Card>
      </div>
    );
  }

  /* ── Choose and pay ─────────────────────────────────────────── */
  return (
    <div className="max-w-2xl space-y-6">
      <PageTitle
        title="Choose your annual plan"
        subtitle="Annual access for 365 days of automated trading. Pay once per year via MTN or Airtel Mobile Money."
      />

      <PlanGrid selected={selected} onSelect={setSelected} locked={state === 'waiting'} />

      {/* ── Active Waiting Card with PIN Prompt & Cancel ── */}
      {state === 'waiting' && (
        <Card className="p-5 sm:p-6 border-accent/40 bg-accent/[0.03] shadow-lg animate-in fade-in duration-200">
          <div className="flex items-start gap-3.5">
            <div className="relative flex items-center justify-center shrink-0 mt-0.5">
              <span className="animate-ping absolute inline-flex h-10 w-10 rounded-full bg-accent opacity-30"></span>
              <div className="w-10 h-10 rounded-full bg-accent-soft text-accent flex items-center justify-center border border-accent/40">
                <Smartphone className="w-5 h-5" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-ink">
                  Waiting for Mobile Money PIN
                </h3>
                <span className="flex items-center gap-1 text-[12px] font-mono font-medium text-accent bg-accent-soft px-2 py-0.5 rounded-full border border-accent/20">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTimer(timeLeft)}
                </span>
              </div>
              <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
                A payment prompt for <strong className="text-ink">{ugx(plan.price)}</strong> (1 Year {plan.name}) was sent to:
              </p>
              <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-line-strong font-mono text-[13.5px] text-accent font-semibold">
                <PhoneCall className="w-3.5 h-3.5" />
                +256 {phone.replace(/\D/g, '')}
              </div>

              <div className="mt-3.5 p-3 rounded-lg bg-canvas/60 border border-line text-[12px] text-ink-soft space-y-1">
                <p className="font-medium text-ink flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Check your phone screen now
                </p>
                <p className="text-ink-faint leading-relaxed pl-3">
                  Enter your 4-digit PIN to authorize payment. This page updates automatically the second your approval is confirmed.
                </p>
              </div>

              {/* Action Buttons: Cancel & Change Number */}
              <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  id="cancel-payment-btn"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="btn btn-danger flex-1 justify-center text-[13px] py-2.5"
                >
                  <Edit3 className="w-4 h-4 mr-1.5" />
                  Wrong number? Cancel & change
                </button>
                <button
                  type="button"
                  onClick={() => pay(undefined, true)}
                  disabled={submitting || cancelling}
                  className="btn btn-ghost text-[13px] py-2.5 justify-center"
                >
                  <RefreshCw className={cx('w-3.5 h-3.5 mr-1.5', submitting && 'animate-spin')} />
                  Resend prompt
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {notice && state !== 'waiting' && <Notice tone="info">{notice}</Notice>}

      {state === 'failed' && error && (
        <Notice tone="error" title="Payment not completed">
          <p>{error}</p>
          <button onClick={reset} className="mt-2 font-semibold underline cursor-pointer inline-flex items-center gap-1 text-[13px]">
            <RefreshCw className="w-3.5 h-3.5" />
            Try again with a different number
          </button>
        </Notice>
      )}

      {state !== 'failed' && state !== 'waiting' && error && <Notice tone="error">{error}</Notice>}

      {state !== 'waiting' && (
        <PayForm
          phone={phone}
          setPhone={setPhone}
          amount={plan.price}
          planName={plan.name}
          onSubmit={(e) => pay(e, false)}
          submitting={submitting}
          disabled={false}
        />
      )}

      <div className="p-4 rounded-xl bg-surface/50 border border-line text-[11.5px] text-ink-faint leading-relaxed space-y-1.5">
        <p className="font-semibold text-ink-soft flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-accent" />
          Annual Subscription Guarantee
        </p>
        <p>
          Payments are securely processed via Investio Mobile Money Gateway. Once completed, your 365-day algorithmic trading license is instantly issued. You can disconnect your broker at any time.
        </p>
      </div>
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
    <div className="grid sm:grid-cols-2 gap-3.5">
      {PLANS.map((p) => {
        const active = selected === p.id;
        return (
          <button
            key={p.id}
            type="button"
            disabled={locked}
            onClick={() => onSelect(p.id)}
            className={cx(
              'text-left p-4 sm:p-5 rounded-[16px] border transition-all cursor-pointer disabled:cursor-not-allowed relative',
              active
                ? 'border-accent bg-accent/[0.04] shadow-md shadow-accent/5 ring-1 ring-accent/30'
                : 'border-line bg-surface hover:border-line-strong'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[16px] font-semibold text-ink">{p.name}</h3>
                  {p.recommended && (
                    <span className="chip border-accent/40 bg-accent-soft text-accent text-[10.5px] font-medium">
                      Most Popular
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-ink-faint mt-0.5">{p.tagline}</p>
              </div>
              <span
                className={cx(
                  'w-5 h-5 rounded-full shrink-0 flex items-center justify-center border transition-colors',
                  active ? 'bg-accent border-accent text-canvas' : 'border-line-strong bg-canvas/40'
                )}
              >
                {active && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
              </span>
            </div>

            <div className="mt-3.5 flex items-baseline gap-1.5">
              <span className="tnum text-[24px] font-bold text-ink">{ugx(p.price)}</span>
              <span className="text-[12px] font-medium text-ink-faint">/ 1 year (365 days)</span>
            </div>

            <ul className="mt-3.5 space-y-2 border-t border-line/60 pt-3">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[12.5px] text-ink-soft">
                  <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" strokeWidth={2.5} />
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
  planName,
  onSubmit,
  submitting,
  disabled,
}: {
  phone: string;
  setPhone: (v: string) => void;
  amount: number;
  planName: string;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  disabled: boolean;
}) {
  return (
    <Card className="p-5 border-line shadow-sm">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Mobile Money Number (MTN / Airtel)"
          help="Enter your Ugandan number (e.g. 0770123456). A secure PIN prompt will be sent immediately."
        >
          <div className="relative mt-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13.5px] font-mono text-ink-soft pointer-events-none border-r border-line pr-3">
              🇺🇬 +256
            </span>
            <input
              id="subscribe-phone"
              type="tel"
              inputMode="numeric"
              required
              disabled={disabled}
              placeholder="770 123 456"
              className="field tnum pl-[88px] text-[15px] font-medium tracking-wide"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </Field>

        <div className="flex items-center justify-between p-3 rounded-lg bg-canvas/40 border border-line">
          <div>
            <span className="text-[13px] text-ink-soft block">{planName} Annual License</span>
            <span className="text-[11px] text-ink-faint">Full 365 Days Access</span>
          </div>
          <span className="tnum text-[17px] font-bold text-accent">{ugx(amount)}</span>
        </div>

        <Button
          id="subscribe-submit"
          type="submit"
          block
          loading={submitting}
          disabled={disabled}
          className="py-3 text-[14px] font-semibold"
        >
          {disabled ? (
            <>
              <XCircle className="w-4 h-4" />
              Waiting for PIN Approval
            </>
          ) : (
            <>
              <Smartphone className="w-4 h-4" />
              Send Annual Payment Prompt ({ugx(amount)})
            </>
          )}
        </Button>
      </form>
    </Card>
  );
}
