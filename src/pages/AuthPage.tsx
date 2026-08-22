import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';
import {
  LogIn,
  UserPlus,
  Lock,
  Eye,
  EyeOff,
  Zap,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Layers,
} from 'lucide-react';

const LIVE_TICKERS = [
  { pair: 'XAU/USD (Gold)', change: '+3.42%', price: '$2,914.80', up: true },
  { pair: 'EUR/USD', change: '+0.85%', price: '1.0872', up: true },
  { pair: 'GBP/USD', change: '+1.14%', price: '1.2740', up: true },
  { pair: 'USD/JPY', change: '-0.38%', price: '154.20', up: false },
  { pair: 'GBP/JPY', change: '+1.62%', price: '196.45', up: true },
];

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
      setError('Please enter a valid phone number (e.g. 0770123456)');
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
        errorMessage = 'Incorrect password. Please verify and try again.';
      else if (err.code === 'auth/user-not-found')
        errorMessage = 'No account found for this phone number. Please sign up.';
      else if (err.code === 'auth/invalid-email')
        errorMessage = 'Invalid phone number format.';
      else if (errorMessage.includes('email'))
        errorMessage = errorMessage.replace(/email/gi, 'phone number');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-radial-grid flex flex-col justify-between relative overflow-hidden">
      {/* Top Live Market Ticker */}
      <header className="border-b border-white/5 bg-slate-950/60 backdrop-blur-md sticky top-0 z-30 overflow-hidden">
        <div className="flex items-center overflow-x-auto hide-scrollbar py-2 px-4 gap-6 text-xs whitespace-nowrap">
          <div className="flex items-center gap-2 text-emerald-400 font-bold shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] tracking-wider uppercase">Live Markets</span>
          </div>
          <div className="flex items-center gap-6 divide-x divide-white/10 font-mono text-[11px]">
            {LIVE_TICKERS.map((t, idx) => (
              <div key={idx} className="flex items-center gap-2 pl-6 first:pl-0">
                <span className="font-semibold text-slate-300">{t.pair}</span>
                <span className="text-slate-400">{t.price}</span>
                <span className={`font-bold ${t.up ? 'text-emerald-400' : 'text-rose-400'}`}>{t.change}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10 z-10">
        <div className="w-full max-w-6xl grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-14 items-center">
          
          {/* Left Column: Premium Branding & Live Bot Features (Desktop + Tablet) */}
          <div className="space-y-6 lg:space-y-8">
            {/* Brand Header */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-extrabold tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next-Gen Algorithmic Trading</span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.15]">
                Automate Your Trades With{' '}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  Institutional AI
                </span>
              </h1>
              
              <p className="text-sm sm:text-base text-slate-400 max-w-xl leading-relaxed">
                Connect your verified <span className="text-amber-300 font-bold">Exness</span> or <span className="text-cyan-300 font-bold">FBS</span> broker. 
                Deposit securely through Investio Mobile Money channel and start automated 24/7 execution.
              </p>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border-emerald-500/20 bg-emerald-950/10">
                <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  <TrendingUp className="w-3.5 h-3.5" /> Win Rate
                </div>
                <div className="text-lg sm:text-2xl font-black text-white mt-1 font-mono">92.4%</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Verified Backtest</div>
              </div>

              <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border-cyan-500/20 bg-cyan-950/10">
                <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5" /> Execution
                </div>
                <div className="text-lg sm:text-2xl font-black text-white mt-1 font-mono">18ms</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Ultra Low Latency</div>
              </div>

              <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border-blue-500/20 bg-blue-950/10">
                <div className="flex items-center gap-1.5 text-blue-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5" /> Brokers
                </div>
                <div className="text-lg sm:text-2xl font-black text-white mt-1">Exness &bull; FBS</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Direct API Sync</div>
              </div>
            </div>

            {/* Packages Preview Banner */}
            <div className="hidden sm:block glass-panel p-5 rounded-3xl space-y-3 border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" /> Active Subscription Packages
                </span>
                <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  Investio Channel Enabled
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-200">Standard Package</div>
                    <div className="text-[11px] text-slate-400">3 Pairs &bull; Basic Algo</div>
                  </div>
                  <div className="text-right font-mono font-black text-white text-sm">
                    UGX 50,000
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900/90 border border-emerald-500/30 flex items-center justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/10 rounded-full blur-xl"></div>
                  <div>
                    <div className="text-xs font-black text-emerald-300 flex items-center gap-1">
                      VIP Package <Sparkles className="w-3 h-3 text-amber-400" />
                    </div>
                    <div className="text-[11px] text-slate-400">All Pairs &bull; Turbo Algo</div>
                  </div>
                  <div className="text-right font-mono font-black text-emerald-400 text-sm">
                    UGX 100,000
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sleek Auth Card */}
          <div className="w-full max-w-md mx-auto">
            <div className="glass-panel p-6 sm:p-8 rounded-3xl sm:rounded-[32px] border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative overflow-hidden">
              
              {/* Subtle top ambient glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>

              {/* Segmented Control / Pill Switcher */}
              <div className="relative p-1 bg-slate-950/80 border border-white/5 rounded-2xl flex items-center mb-6">
                <button
                  type="button"
                  onClick={() => { setIsLogin(true); setError(''); }}
                  className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                    isLogin
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LogIn className="w-4 h-4" /> Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setIsLogin(false); setError(''); }}
                  className={`flex-1 py-3 text-xs sm:text-sm font-black rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                    !isLogin
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-4 h-4" /> Create Account
                </button>
              </div>

              {/* Form Title */}
              <div className="mb-5">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {isLogin ? 'Access Trading Terminal' : 'Start Automated Trading'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {isLogin
                    ? 'Enter your mobile phone number to log in.'
                    : 'Sign up in 30 seconds using your phone number.'}
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold flex items-center gap-2.5 animate-slide-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0"></span>
                  <span>{error}</span>
                </div>
              )}

              {/* Input Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                    Phone Number
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center gap-1.5 pointer-events-none text-slate-400 font-mono text-xs border-r border-white/10 pr-2.5">
                      <span>🇺🇬</span>
                      <span className="font-bold text-slate-300">+256</span>
                    </div>
                    <input
                      id="auth-phone-input"
                      type="tel"
                      required
                      placeholder="770 123 456"
                      className="w-full pl-24 pr-4 py-3.5 bg-slate-950/70 border border-white/10 rounded-2xl text-white font-mono text-sm font-semibold focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all placeholder:text-slate-600"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500">Enter your MTN or Airtel Uganda number</p>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-password-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      className="w-full pl-11 pr-11 py-3.5 bg-slate-950/70 border border-white/10 rounded-2xl text-white text-sm font-semibold focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all placeholder:text-slate-600"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password (for signup) */}
                {!isLogin && (
                  <div className="space-y-1.5 animate-slide-in">
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-confirm-password-input"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        className="w-full pl-11 pr-11 py-3.5 bg-slate-950/70 border border-white/10 rounded-2xl text-white text-sm font-semibold focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all placeholder:text-slate-600"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Submit Action Button */}
                <button
                  id="auth-submit-button"
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  ) : isLogin ? (
                    <>
                      <span>Open Trading Terminal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Create Account & Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Bottom Security Footer */}
              <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400/90 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Investio Protected
                </span>
                <span>Exness &bull; FBS API Direct</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-slate-500 border-t border-white/5">
        &copy; {new Date().getFullYear()} TradeBot Automated Forex Terminal &bull; Powered by Investio Channel
      </footer>
    </div>
  );
}
