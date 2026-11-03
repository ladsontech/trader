import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { DEFAULT_DIAL, parsePhone } from '../lib/phone';
import { Button, Field, Notice } from '../components/ui';
import { PhoneInput } from '../components/PhoneInput';
import { Bot, Eye, EyeOff, Plug, ShieldCheck, Wallet } from 'lucide-react';

const STEPS = [
  { icon: Wallet, label: 'Pay once with mobile money' },
  { icon: Plug, label: 'Connect your Exness or FBS MT5' },
  { icon: Bot, label: 'The bot trades for you 24/5' },
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

  const switchMode = () => {
    setMode(isSignup ? 'signin' : 'signup');
    setError('');
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px] fade-up">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-[11px] bg-accent text-white flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <p className="text-[17px] font-bold tracking-tight">TradeBot</p>
          </div>

          <h1 className="text-[26px] font-bold tracking-tight">
            {isSignup ? 'Start auto-trading' : 'Welcome back'}
          </h1>
          <p className="text-[14px] text-ink-soft mt-1.5 mb-6">
            {isSignup
              ? 'Create your account with your phone number. Takes 30 seconds.'
              : 'Sign in with your phone number and password.'}
          </p>

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
                  placeholder={isSignup ? 'Choose a password (6+ characters)' : 'Your password'}
                  className="field pr-11"
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

            <Button id="auth-submit" type="submit" block loading={loading} className="py-3 text-[15px]">
              {isSignup ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-5 text-center text-[14px] text-ink-soft">
            {isSignup ? 'Already have an account?' : 'New to TradeBot?'}{' '}
            <button
              type="button"
              onClick={switchMode}
              className="font-semibold text-accent hover:underline cursor-pointer"
            >
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>

          {isSignup && (
            <ol className="mt-8 grid gap-2.5">
              {STEPS.map(({ icon: Icon, label }, i) => (
                <li key={label} className="flex items-center gap-3 text-[13px] text-ink-soft">
                  <span className="w-7 h-7 rounded-full bg-surface-2 border border-line flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-accent" />
                  </span>
                  <span>
                    <span className="text-ink-faint tnum mr-1.5">{i + 2}.</span>
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </main>

      <footer className="px-5 pb-8">
        <p className="max-w-[400px] mx-auto text-[11px] text-ink-faint text-center leading-relaxed flex items-start gap-1.5 justify-center">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>
            Your money stays in your own broker account. Leveraged forex trading carries a risk
            of loss.
          </span>
        </p>
      </footer>
    </div>
  );
}
