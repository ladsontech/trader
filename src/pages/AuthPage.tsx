import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { DEFAULT_DIAL, parsePhone } from '../lib/phone';
import { Button, Field, Notice, cx } from '../components/ui';
import { PhoneInput } from '../components/PhoneInput';
import { BRAND_NAME, BrandLogo } from '../components/Brand';
import { ArrowRight, Bot, Eye, EyeOff, Lock, Plug, ShieldCheck, Smartphone, Wallet } from 'lucide-react';

const STEPS = [
  { icon: Wallet, title: 'Pay with mobile money', text: 'MTN, Airtel or M-Pesa. No card needed.' },
  { icon: Plug, title: 'Connect your MT5 account', text: 'Exness or FBS. Your money stays with your broker.' },
  { icon: Bot, title: 'The bot trades for you', text: 'Runs 24/5 with stop-loss on every trade.' },
];

/** Decorative candles for the brand panel (not real market data). */
const CANDLES = [
  [62, 70, 54, 76], [70, 66, 60, 74], [66, 78, 63, 82], [78, 74, 70, 81], [74, 86, 72, 90],
  [86, 82, 79, 89], [82, 94, 80, 98], [94, 90, 86, 97], [90, 104, 88, 108], [104, 112, 100, 116],
  [112, 108, 104, 115], [108, 122, 106, 126],
];

function MarketArt() {
  const w = 360;
  const h = 150;
  const step = w / CANDLES.length;
  const y = (v: number) => h - ((v - 48) / 82) * h;
  const line = CANDLES.map(([, c], i) => `${i * step + step / 2},${y(c)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" aria-hidden>
      <defs>
        <linearGradient id="auth-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2dd4bf" stopOpacity="0.28" />
          <stop offset="1" stopColor="#2dd4bf" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`${step / 2},${h} ${line} ${w - step / 2},${h}`} fill="url(#auth-area)" />
      {CANDLES.map(([o, c, lo, hi], i) => {
        const x = i * step + step / 2;
        const up = c >= o;
        const color = up ? '#34d399' : '#f87171';
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(hi)} y2={y(lo)} stroke={color} strokeWidth="1.5" strokeOpacity="0.8" />
            <rect
              x={x - step * 0.22}
              y={y(Math.max(o, c))}
              width={step * 0.44}
              height={Math.max(3, Math.abs(y(o) - y(c)))}
              rx="2"
              fill={color}
            />
          </g>
        );
      })}
      <polyline points={line} fill="none" stroke="#5eead4" strokeWidth="1.5" strokeDasharray="4 4" strokeOpacity="0.6" />
    </svg>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [dial, setDial] = useState(DEFAULT_DIAL);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const parsed = parsePhone(dial, phone);
    if (!parsed.ok) {
      setError(parsed.error || 'Enter a valid phone number.');
      return;
    }
    if (password.length < 6) {
      setError('Your password needs at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        const cred = await createUserWithEmailAndPassword(auth, parsed.identity, password);
        await setDoc(
          doc(db, 'tradebot_users', cred.user.uid),
          {
            phoneDigits: parsed.display,
            country: parsed.country,
            currency: parsed.dial === '254' ? 'KES' : 'UGX',
            subscriptionStatus: 'none',
            brokerConnected: false,
            botEnabled: false,
            isAdmin: false,
            createdAt: new Date(),
          },
          { merge: true }
        );
      } else {
        await signInWithEmailAndPassword(auth, parsed.identity, password);
      }
    } catch (err) {
      const code = (err as { code?: string }).code || '';
      const messages: Record<string, string> = {
        'auth/email-already-in-use': 'That number already has an account. Sign in instead.',
        'auth/invalid-credential': 'That number and password do not match.',
        'auth/wrong-password': 'That number and password do not match.',
        'auth/user-not-found': 'No account for that number yet. Create one.',
        'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
        'auth/network-request-failed': 'No connection. Check your internet and try again.',
      };
      setError(messages[code] || 'Something went wrong. Please try again.');
      if (code === 'auth/email-already-in-use') setMode('signin');
    } finally {
      setLoading(false);
    }
  };

  const pickMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setError('');
  };

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* ── Brand panel (desktop) ── */}
      <aside className="auth-panel hidden lg:flex flex-col justify-between p-12 xl:p-14 text-white relative overflow-hidden">
        <BrandLogo light size={40} className="text-[19px] relative" />

        <div className="relative max-w-[460px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[12px] font-medium text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34d399] pulse-dot" />
            Automated forex trading on MetaTrader 5
          </span>
          <h2 className="mt-5 text-[38px] xl:text-[42px] font-bold leading-[1.1] tracking-tight">
            Let the bot trade
            <br />
            <span className="bg-gradient-to-r from-[#5eead4] to-[#34d399] bg-clip-text text-transparent">
              while you live your life.
            </span>
          </h2>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[12px] text-white/60 mb-2">
              <span className="font-semibold text-white/85">Expert Advisor</span>
              <span className="tnum">MT5 · 24/5</span>
            </div>
            <MarketArt />
          </div>

          <ol className="mt-8 space-y-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                  <Icon className="h-[18px] w-[18px] text-[#5eead4]" />
                  <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#0e9f77] text-[10px] font-bold tnum">
                    {i + 2}
                  </span>
                </span>
                <span>
                  <span className="block text-[14.5px] font-semibold">{title}</span>
                  <span className="block text-[13px] text-white/60">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <p className="relative text-[11.5px] leading-relaxed text-white/45 max-w-[460px]">
          Leveraged forex trading carries a risk of loss. Past performance does not guarantee future
          results. Only trade money you can afford to lose.
        </p>
      </aside>

      {/* ── Form side ── */}
      <div className="flex min-h-screen flex-col">
        {/* Mobile brand header */}
        <header className="auth-panel lg:hidden relative overflow-hidden px-5 pt-6 pb-14 text-white">
          <BrandLogo light size={36} className="text-[17px] relative" />
          <p className="relative mt-5 text-[22px] font-bold leading-tight tracking-tight">
            Let the bot trade{' '}
            <span className="bg-gradient-to-r from-[#5eead4] to-[#34d399] bg-clip-text text-transparent">
              for you.
            </span>
          </p>
          <p className="relative mt-1 text-[13px] text-white/65">Mobile money · Exness &amp; FBS MT5 · 24/5</p>
        </header>

        <main className="flex flex-1 items-start lg:items-center justify-center px-4 sm:px-6 -mt-8 lg:mt-0 pb-8 lg:py-12">
          <div className="w-full max-w-[420px] fade-up rounded-[20px] border border-line bg-surface p-6 sm:p-8 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_50px_-12px_rgba(15,23,42,0.18)] lg:border-0 lg:shadow-none lg:p-0">
            {/* Mode switch */}
            <div role="tablist" aria-label="Account" className="grid grid-cols-2 rounded-xl bg-surface-2 p-1 border border-line">
              {(
                [
                  ['signup', 'Create account'],
                  ['signin', 'Sign in'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => pickMode(key)}
                  className={cx(
                    'rounded-[9px] py-2 text-[13.5px] font-semibold transition-all cursor-pointer',
                    mode === key
                      ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(15,23,42,0.12)]'
                      : 'text-ink-soft hover:text-ink'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <h1 className="mt-7 text-[26px] font-bold tracking-tight">
              {isSignup ? 'Start auto-trading' : 'Welcome back'}
            </h1>
            <p className="text-[14px] text-ink-soft mt-1.5 mb-6">
              {isSignup
                ? `Create your ${BRAND_NAME} account with your phone number. Takes 30 seconds.`
                : 'Sign in with your phone number and password.'}
            </p>

            <form onSubmit={submit} className="space-y-4" noValidate>
              <Field label="Phone number">
                <PhoneInput id="auth-phone" dial={dial} onDialChange={setDial} value={phone} onChange={setPhone} />
              </Field>

              <Field label="Password">
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    required
                    placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
                    className="field pl-10 pr-11 py-3"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink-soft cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              {error && <Notice tone="error">{error}</Notice>}

              <Button
                id="auth-submit"
                type="submit"
                block
                loading={loading}
                className="auth-submit py-3.5 text-[15px] rounded-xl"
              >
                {isSignup ? 'Create account' : 'Sign in'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </form>

            <ul className="mt-6 grid grid-cols-3 gap-2 text-center">
              {[
                { icon: ShieldCheck, label: 'Secure sign-in' },
                { icon: Smartphone, label: 'Mobile money' },
                { icon: Plug, label: 'Exness & FBS' },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-2 border border-line px-2 py-2.5">
                  <Icon className="w-4 h-4 text-accent" />
                  <span className="text-[11px] font-medium text-ink-soft leading-tight">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </main>

        <footer className="lg:hidden px-5 pb-8">
          <p className="max-w-[420px] mx-auto text-[11px] text-ink-faint text-center leading-relaxed flex items-start gap-1.5 justify-center">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>Your money stays in your own broker account. Leveraged forex trading carries a risk of loss.</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
