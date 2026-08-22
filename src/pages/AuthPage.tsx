import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Button, Field, Notice, cx } from '../components/ui';
import { Bot, Eye, EyeOff } from 'lucide-react';

/**
 * Phone-number sign-in, mapped onto a Firebase email identity so it shares
 * the Investio auth project. Deliberately plain: two fields, one button.
 */
export default function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const digits = phone.replace(/\D/g, '');
    const normalized =
      digits.startsWith('256') && digits.length === 12
        ? `0${digits.slice(3)}`
        : digits.length === 9
          ? `0${digits}`
          : digits;

    if (!/^0(7|3)\d{8}$/.test(normalized)) {
      setError('Enter a valid MTN or Airtel number, for example 0770123456.');
      return;
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
      const identity = `${normalized}@investio.app`;
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, identity, password);
      } else {
        await signInWithEmailAndPassword(auth, identity, password);
      }
      // The gate in App.tsx takes it from here.
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
          <div className="flex items-center gap-2.5 mb-9">
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
          <p className="text-[13px] text-ink-soft mt-1 mb-6">
            {isSignup
              ? 'Your phone number is your login. One minute and you are in.'
              : 'Sign in with the number you registered.'}
          </p>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Phone number">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint tnum pointer-events-none border-r border-line pr-2.5">
                  +256
                </span>
                <input
                  id="auth-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  placeholder="770 123 456"
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
