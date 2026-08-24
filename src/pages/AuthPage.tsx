import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Button, Field, Notice, cx } from '../components/ui';
import { Bot, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

export default function AuthPage() {
  const { setCountry: setGlobalCountry } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [country, setCountry] = useState<'UG' | 'KE'>('UG');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';
  const isKenya = country === 'KE';
  const dialCode = isKenya ? '+254' : '+256';

  const handleCountryChange = (c: 'UG' | 'KE') => {
    setCountry(c);
    setGlobalCountry(c);
    setError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const digits = phone.replace(/\D/g, '');
    let normalized = digits;

    if (isKenya) {
      if (digits.startsWith('254') && digits.length === 12) normalized = `0${digits.slice(3)}`;
      else if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('1'))) normalized = `0${digits}`;
      else if (digits.length === 10 && digits.startsWith('0')) normalized = digits;

      if (!/^0(7|1)\d{8}$/.test(normalized)) {
        setError('Enter a valid Safaricom M-Pesa or Airtel Kenya number, e.g. 0712345678.');
        return;
      }
    } else {
      if (digits.startsWith('256') && digits.length === 12) normalized = `0${digits.slice(3)}`;
      else if (digits.length === 9 && digits.startsWith('7')) normalized = `0${digits}`;
      else if (digits.length === 10 && digits.startsWith('0')) normalized = digits;

      if (!/^0(7|3)\d{8}$/.test(normalized)) {
        setError('Enter a valid MTN or Airtel Uganda number, e.g. 0770123456.');
        return;
      }
    }

    if (password.length < 6) {
      setError('Your password needs at least 6 characters.');
      return;
    }
    if (isSignup && password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const emailPrefix = isKenya ? `254${normalized.slice(1)}` : normalized;
      const identity = `${emailPrefix}@investio.app`;

      if (isSignup) {
        const cred = await createUserWithEmailAndPassword(auth, identity, password);
        await setDoc(doc(db, 'tradebot_users', cred.user.uid), {
          phoneDigits: normalized,
          country,
          currency: isKenya ? 'KES' : 'UGX',
          subscriptionStatus: 'none',
          brokerConnected: false,
          botEnabled: false,
          createdAt: new Date(),
        }, { merge: true });
      } else {
        await signInWithEmailAndPassword(auth, identity, password);
      }
    } catch (err) {
      const code = (err as { code?: string }).code || '';
      const messages: Record<string, string> = {
        'auth/email-already-in-use':
          'That number already has an account. Sign in instead.',
        'auth/invalid-credential': 'That number and password do not match.',
        'auth/wrong-password': 'That number and password do not match.',
        'auth/user-not-found': 'No account for that number yet. Create one.',
        'auth/too-many-requests':
          'Too many attempts. Wait a minute and try again.',
        'auth/network-request-failed':
          'No connection. Check your internet and try again.',
      };
      setError(messages[code] || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-backdrop flex flex-col">
      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[380px] fade-up">
          {/* Brand */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-[10px] bg-accent-soft border border-accent/25 flex items-center justify-center">
              <Bot className="w-[18px] h-[18px] text-accent" />
            </div>
            <div>
              <p className="text-[15px] font-semibold leading-tight">TradeBot</p>
              <p className="text-[11px] text-ink-faint leading-tight">
                Automated forex, on your own broker
              </p>
            </div>
          </div>

          <h1 className="text-[22px] font-semibold">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="text-[13px] text-ink-soft mt-1 mb-5">
            {isSignup
              ? 'Select your country and enter your phone number to get started.'
              : 'Sign in with the number and country you registered.'}
          </p>

          {/* Country Selection */}
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-ink-muted mb-1.5 uppercase tracking-wider">
              Country / Region
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleCountryChange('UG')}
                className={cx(
                  'flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer',
                  country === 'UG'
                    ? 'border-accent bg-accent-soft text-ink-base shadow-xs'
                    : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink-base'
                )}
              >
                <span>🇺🇬</span>
                <span>Uganda (UGX)</span>
              </button>
              <button
                type="button"
                onClick={() => handleCountryChange('KE')}
                className={cx(
                  'flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition cursor-pointer',
                  country === 'KE'
                    ? 'border-accent bg-accent-soft text-ink-base shadow-xs'
                    : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink-base'
                )}
              >
                <span>🇰🇪</span>
                <span>Kenya (KES)</span>
              </button>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field label={isKenya ? 'M-Pesa / Phone number' : 'Mobile Money number'}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint tnum pointer-events-none border-r border-line pr-2.5">
                  {dialCode}
                </span>
                <input
                  id="auth-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  placeholder={isKenya ? '712 345 678 or 140 123 456' : '770 123 456'}
                  className="field tnum pl-[74px]"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </Field>

            <Field label="Password">
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  required
                  placeholder="At least 6 characters"
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

            {isSignup && (
              <Field label="Confirm password">
                <input
                  id="auth-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  placeholder="Type it again"
                  className="field"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
            )}

            {error && <Notice tone="error">{error}</Notice>}

            <Button type="submit" block loading={loading}>
              {isSignup ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-[13px] text-ink-soft">
            {isSignup ? 'Already registered?' : 'New here?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(isSignup ? 'signin' : 'signup');
                setError('');
              }}
              className={cx('font-semibold text-accent hover:underline cursor-pointer')}
            >
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </main>

      <footer className="px-5 pb-8">
        <p className="max-w-[380px] mx-auto text-[11px] text-ink-faint text-center leading-relaxed">
          Trading leveraged forex carries a risk of losing money. TradeBot places orders on
          your own broker account and never holds your funds.
        </p>
      </footer>
    </div>
  );
}
