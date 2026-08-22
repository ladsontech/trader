import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';
import {
  LogIn,
  UserPlus,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Bot,
  TrendingUp,
  Shield,
  Zap,
} from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshUserData } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 9) {
      setError('Please enter a valid phone number');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const dummyEmail = `${phoneDigits}@investio.app`;
      if (isLogin) {
        const { user } = await signInWithEmailAndPassword(auth, dummyEmail, password);
        await refreshUserData(user);
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, dummyEmail, password);
        await refreshUserData(user);
      }
    } catch (err: any) {
      let errorMessage = err.message || 'Authentication failed';
      if (err.code === 'auth/email-already-in-use')
        errorMessage = 'This phone number is already registered. Please sign in instead.';
      else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password')
        errorMessage = 'Incorrect password. Please try again.';
      else if (err.code === 'auth/user-not-found')
        errorMessage = 'No account found. Please sign up first.';
      else if (err.code === 'auth/invalid-email')
        errorMessage = 'Invalid phone number format.';
      else if (errorMessage.includes('email'))
        errorMessage = errorMessage.replace(/email/gi, 'phone number');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: <Bot className="w-5 h-5" />,
      title: 'AI-Powered Trading',
      desc: 'Automated signals executed on your broker account',
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Exness & FBS',
      desc: 'Connect your preferred broker in seconds',
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'Risk Management',
      desc: 'Smart lot sizing and stop-loss protection',
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: 'Instant Setup',
      desc: 'Subscribe, connect, and start trading in minutes',
    },
  ];

  return (
    <div className="min-h-screen flex gradient-mesh">
      {/* Left Panel — Features (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 xl:px-24 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/[0.06] to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--accent-blue)] to-[#2563EB] flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">TradeBot</h1>
              <p className="text-xs text-[var(--text-muted)] font-semibold">Automated Forex Trading</p>
            </div>
          </div>

          <h2 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.1] mb-4">
            Let AI trade
            <br />
            <span className="bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-emerald)] bg-clip-text text-transparent">
              while you sleep.
            </span>
          </h2>
          <p className="text-[var(--text-secondary)] text-base leading-relaxed mb-10 max-w-md">
            Subscribe, connect your Exness or FBS broker account, and our bot handles the rest.
            Real-time trade execution with smart risk management.
          </p>

          <div className="grid grid-cols-2 gap-4 stagger-children">
            {features.map((f, i) => (
              <div
                key={i}
                className="glass-card p-4 group cursor-default"
              >
                <div className="w-9 h-9 rounded-xl bg-[var(--accent-blue)]/10 flex items-center justify-center mb-3 text-[var(--accent-blue)] group-hover:bg-[var(--accent-blue)]/20 transition-colors">
                  {f.icon}
                </div>
                <h3 className="text-sm font-bold mb-1">{f.title}</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--accent-blue)] to-[#2563EB] flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">TradeBot</h1>
              <p className="text-[10px] text-[var(--text-muted)] font-semibold">Automated Forex Trading</p>
            </div>
          </div>

          <div className="glass-card p-7 sm:p-9">
            {/* Toggle */}
            <div className="flex rounded-xl bg-[var(--bg-secondary)] p-1 mb-7">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  isLogin
                    ? 'bg-[var(--accent-blue)] text-white shadow-md shadow-blue-500/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  !isLogin
                    ? 'bg-[var(--accent-blue)] text-white shadow-md shadow-blue-500/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                Sign Up
              </button>
            </div>

            <h2 className="text-lg font-black mb-1">
              {isLogin ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-6">
              {isLogin
                ? 'Sign in with your phone number to continue.'
                : 'Sign up with your phone number to get started.'}
            </p>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-[var(--accent-rose-dim)] text-[var(--accent-rose)] text-xs font-semibold border border-rose-500/20">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Phone */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    id="auth-phone-input"
                    type="tel"
                    required
                    placeholder="e.g. 0770123456"
                    className="input-dark"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    id="auth-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min. 6 characters"
                    className="input-dark !pr-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              {!isLogin && (
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                      id="auth-confirm-password-input"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Re-enter password"
                      className="input-dark !pr-11"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-pointer"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                id="auth-submit-button"
                type="submit"
                disabled={loading}
                className="btn-primary mt-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isLogin ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Create Account
                  </>
                )}
              </button>
            </form>

            <p className="text-center text-[10px] text-[var(--text-muted)] mt-5">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                className="text-[var(--accent-blue)] font-bold hover:underline cursor-pointer"
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>

          <p className="text-center text-[9px] text-[var(--text-muted)] mt-5 opacity-60">
            Payments powered by Investio &bull; MarzPay
          </p>
        </div>
      </div>
    </div>
  );
}
