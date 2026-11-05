import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { DEFAULT_DIAL, parsePhone } from '../lib/phone';
import { Button, Field, Notice, cx } from '../components/ui';
import { PhoneInput } from '../components/PhoneInput';
import { BRAND_NAME, BrandLogo } from '../components/Brand';
import { ArrowRight, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';

const TICKERS = [
  { pair: 'XAU/USD', price: '2,914.80', change: '+0.84%' },
  { pair: 'EUR/USD', price: '1.0869', change: '+0.25%' },
  { pair: 'BTC/USD', price: '89,420', change: '+1.62%' },
  { pair: 'GBP/JPY', price: '196.26', change: '+0.41%' },
];

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
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Clean Exness / Binance style top bar */}
      <header className="h-15 bg-surface border-b border-line">
        <div className="h-full max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <BrandLogo size={32} className="text-[16px]" />

          <div className="hidden md:flex items-center gap-5 text-[12px]">
            {TICKERS.map((t) => (
              <div key={t.pair} className="flex items-center gap-1.5">
                <span className="font-semibold text-ink-soft">{t.pair}</span>
                <span className="tnum text-ink font-medium">{t.price}</span>
                <span className="tnum text-[#00a86b] font-semibold">{t.change}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-[12px] text-ink-soft font-medium">
            <Lock className="w-3.5 h-3.5 text-[#00a86b]" />
            <span>MT5 Direct</span>
          </div>
        </div>
      </header>

      {/* Centered Personal Area card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[420px] fade-up">
          <div className="card p-6 sm:p-8">
            <h1 className="text-[22px] sm:text-[24px] font-bold tracking-tight text-ink">
              {isSignup ? 'Start auto-trading' : 'Welcome back'}
            </h1>
            <p className="text-[13.5px] text-ink-soft mt-1">
              {isSignup
                ? `Create your ${BRAND_NAME} account with your phone number.`
                : 'Sign in with your phone number and password.'}
            </p>

            {/* Clean Exness-style underline tab bar */}
            <div
              role="tablist"
              aria-label="Account"
              className="mt-5 mb-6 grid grid-cols-2 border-b border-line"
            >
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
                    'pb-3 text-[13.5px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer',
                    mode === key
                      ? 'border-ink text-ink'
                      : 'border-transparent text-ink-faint hover:text-ink-soft'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4" noValidate>
              <Field label="Phone number">
                <PhoneInput
                  id="auth-phone"
                  dial={dial}
                  onDialChange={setDial}
                  value={phone}
                  onChange={setPhone}
                />
              </Field>

              <Field label="Password">
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    required
                    placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
                    className="field pr-11 py-3"
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
                className="py-3 text-[14.5px] mt-1"
              >
                {isSignup ? 'Create account' : 'Sign in'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </form>

            {/* Partner / feature strip */}
            <div className="mt-6 pt-5 border-t border-line flex items-center justify-between text-[11.5px] text-ink-faint">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded bg-[#ffcf01]/20 px-1.5 py-0.5 text-[10.5px] font-bold text-[#0b0e11]">
                  Exness
                </span>
                <span className="inline-flex items-center rounded bg-[#00a86b]/12 px-1.5 py-0.5 text-[10.5px] font-bold text-[#008f5a]">
                  FBS
                </span>
                <span>MT5 Compatible</span>
              </div>
              <span className="font-medium text-ink-soft">24/5 Auto-Trading</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-4 pb-6">
        <p className="max-w-[420px] mx-auto text-[11.5px] text-ink-faint text-center leading-relaxed flex items-center gap-1.5 justify-center">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-ink-soft" />
          <span>Your funds remain in your own broker account. Trading carries a risk of loss.</span>
        </p>
      </footer>
    </div>
  );
}
