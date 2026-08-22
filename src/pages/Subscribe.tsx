import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth-context';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, app } from '../lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { PACKAGES } from '../lib/constants';
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Crown,
  Sparkles,
  Check,
  Bot,
  ArrowRight,
  Wallet
} from 'lucide-react';
import { Link } from 'react-router';

const functions = getFunctions(app);
const pendingSubStorageKey = (uid: string) => `tradebot.pendingSub.${uid}`;

export default function Subscribe() {
  const { userData, user, refreshUserData } = useAuth();
  const submittingRef = useRef(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('premium');
  const [phoneNumber, setPhoneNumber] = useState(userData?.phoneDigits || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [txStatus, setTxStatus] = useState<'idle' | 'waiting' | 'completed' | 'failed'>('idle');
  const [currentReference, setCurrentReference] = useState<string | null>(null);

  const isSubscribed = userData?.subscriptionStatus === 'active';

  // Restore pending subscription from localStorage
  useEffect(() => {
    if (!user || currentReference) return;
    const saved = localStorage.getItem(pendingSubStorageKey(user.uid));
    if (!saved) return;
    try {
      const pending = JSON.parse(saved) as { reference?: string; plan?: string };
      if (!pending.reference) {
        localStorage.removeItem(pendingSubStorageKey(user.uid));
        return;
      }
      setCurrentReference(pending.reference);
      if (pending.plan) setSelectedPlan(pending.plan);
      setTxStatus('waiting');
      setLoading(true);
    } catch {
      localStorage.removeItem(pendingSubStorageKey(user.uid));
    }
  }, [user, currentReference]);

  // Listen for real-time payment status via pending_transactions
  useEffect(() => {
    if (!currentReference) return;
    const unsubscribe = onSnapshot(
      doc(db, 'pending_transactions', currentReference),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.status === 'completed') {
            setTxStatus('completed');
            setLoading(false);
            if (user) localStorage.removeItem(pendingSubStorageKey(user.uid));
            const plan = selectedPlan || 'standard';
            const userRef = doc(db, 'tradebot_users', user!.uid);
            updateDoc(userRef, {
              subscriptionPlan: plan,
              subscriptionStatus: 'active',
              subscriptionExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
            }).then(() => refreshUserData());
          } else if (data.status === 'failed') {
            setTxStatus('failed');
            setError(data.failureReason || 'Mobile money transaction was declined or timed out.');
            setLoading(false);
            if (user) localStorage.removeItem(pendingSubStorageKey(user.uid));
          }
        }
      },
      (snapshotError) => {
        console.error('Subscription listener error:', snapshotError);
        setError('Unable to monitor payment status. Please check your network.');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentReference, user, selectedPlan]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPlan || submittingRef.current || txStatus === 'waiting') return;

    const pkg = PACKAGES.find((p) => p.id === selectedPlan);
    if (!pkg) return;

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      setError('Please enter a valid mobile money number (e.g. 0770123456)');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError('');
    setTxStatus('waiting');

    try {
      const initiateDeposit = httpsCallable(functions, 'initiateDeposit');
      const result = await initiateDeposit({
        phoneNumber: cleanPhone,
        amount: pkg.price,
      });

      const data = result.data as {
        success: boolean;
        reference: string;
        reused?: boolean;
        amount?: number;
        phoneNumber?: string;
        message?: string;
      };

      if (data.success) {
        if (user) {
          localStorage.setItem(
            pendingSubStorageKey(user.uid),
            JSON.stringify({ reference: data.reference, plan: selectedPlan })
          );
        }
        setError(data.reused ? (data.message || 'An active mobile money prompt is pending on your phone.') : '');
        setCurrentReference(data.reference);
      } else {
        setError('Failed to send mobile money prompt. Please try again.');
        setLoading(false);
        setTxStatus('failed');
      }
    } catch (err: any) {
      console.error('Payment initiation error:', err);
      setError(err.message || 'Failed to initiate payment. Please check your phone number.');
      setLoading(false);
      setTxStatus('failed');
    } finally {
      submittingRef.current = false;
    }
  };

  const resetForm = () => {
    setTxStatus('idle');
    setCurrentReference(null);
    setError('');
    setLoading(false);
    if (user) localStorage.removeItem(pendingSubStorageKey(user.uid));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* ── HEADER ── */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Select Your Package
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Instant activation via Investio Mobile Money channel (MTN / Airtel).
        </p>
      </div>

      {/* ── ALREADY SUBSCRIBED ── */}
      {isSubscribed && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0F172A] border border-emerald-500/30 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Active Plan: {userData?.subscriptionPlan === 'premium' ? 'VIP Premium' : 'Standard'}</h2>
            <p className="text-xs text-emerald-300/80 mt-1">Your trading bot is enabled and executing trades on your connected broker.</p>
          </div>
          <Link
            to="/broker"
            className="inline-flex items-center gap-2 py-3 px-6 rounded-2xl bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all"
          >
            <span>Manage Broker Connection</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* ── PACKAGE CARDS (Vertical on mobile, side-by-side on tablet/desktop) ── */}
      <div className="grid sm:grid-cols-2 gap-4">
        
        {/* Standard Package (50,000 UGX) */}
        <div
          onClick={() => txStatus !== 'waiting' && setSelectedPlan('standard')}
          className={`p-5 sm:p-6 rounded-3xl border transition-all cursor-pointer relative flex flex-col justify-between ${
            selectedPlan === 'standard'
              ? 'border-emerald-400 bg-[#0F172A] shadow-md'
              : 'border-white/[0.08] bg-[#0F172A]/70 hover:border-white/20'
          }`}
        >
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                <Bot className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 text-slate-400">
                Standard
              </span>
            </div>

            <div>
              <h3 className="text-base font-black text-white">Standard Bot Package</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">3 Major Pairs &bull; Exness & FBS</p>
            </div>

            <div>
              <span className="text-2xl font-black text-white font-mono">UGX 50,000</span>
              <span className="text-xs text-slate-400 font-semibold"> / month</span>
            </div>

            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Up to 3 major Forex currency pairs</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Exness & FBS broker execution</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Automated stop-loss & risk control</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Daily automated trade reports</span>
              </li>
            </ul>
          </div>

          <div className="mt-5 pt-3.5 border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Select Plan</span>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${selectedPlan === 'standard' ? 'bg-emerald-400 text-slate-950' : 'border border-white/20'}`}>
              {selectedPlan === 'standard' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>
        </div>

        {/* Premium Package (100,000 UGX) */}
        <div
          onClick={() => txStatus !== 'waiting' && setSelectedPlan('premium')}
          className={`p-5 sm:p-6 rounded-3xl border transition-all cursor-pointer relative flex flex-col justify-between overflow-hidden ${
            selectedPlan === 'premium'
              ? 'border-emerald-400 bg-gradient-to-br from-emerald-950/30 via-[#0F172A] to-[#0F172A] shadow-md'
              : 'border-white/[0.08] bg-[#0F172A]/70 hover:border-white/20'
          }`}
        >
          {/* Top VIP Badge */}
          <div className="absolute top-0 right-0 px-3.5 py-1 rounded-bl-2xl bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-black text-[9px] uppercase tracking-wider flex items-center gap-1 shadow-sm">
            <Sparkles className="w-3 h-3" /> Recommended
          </div>

          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Crown className="w-5 h-5 text-emerald-400" />
              </div>
            </div>

            <div>
              <h3 className="text-base font-black text-white">VIP Premium Package</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">All Forex Pairs + Gold (XAU/USD)</p>
            </div>

            <div>
              <span className="text-2xl font-black text-emerald-400 font-mono">UGX 100,000</span>
              <span className="text-xs text-slate-400 font-semibold"> / month</span>
            </div>

            <ul className="space-y-2 text-xs text-slate-200">
              <li className="flex items-center gap-2 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Unlimited Forex pairs + Gold (XAU/USD)</span>
              </li>
              <li className="flex items-center gap-2 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Ultra low latency execution (18ms)</span>
              </li>
              <li className="flex items-center gap-2 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Turbo multi-timeframe algorithm</span>
              </li>
              <li className="flex items-center gap-2 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Priority Exness & FBS direct execution</span>
              </li>
            </ul>
          </div>

          <div className="mt-5 pt-3.5 border-t border-white/[0.05] flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400">Select Plan</span>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${selectedPlan === 'premium' ? 'bg-emerald-400 text-slate-950' : 'border border-white/20'}`}>
              {selectedPlan === 'premium' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>
        </div>
      </div>

      {/* ── PAYMENT FORM ── */}
      <div className="p-5 sm:p-7 rounded-3xl bg-[#0F172A] border border-white/[0.08] space-y-5 shadow-sm">
        
        {/* Status Alerts */}
        {txStatus === 'waiting' && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 space-y-1.5 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold">Waiting for Mobile Money PIN confirmation...</p>
              <p className="text-[11px] text-amber-300/80">
                Please approve the phone prompt for UGX {PACKAGES.find(p => p.id === selectedPlan)?.price.toLocaleString()}.
              </p>
            </div>
          </div>
        )}

        {txStatus === 'completed' && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-1.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-bold">Payment Confirmed & Package Activated!</p>
            </div>
            <p className="text-[11px] text-emerald-300/80">
              Your {selectedPlan === 'premium' ? 'VIP Premium' : 'Standard'} plan is now active.
            </p>
            <Link to="/broker" className="inline-block mt-1 text-xs font-black underline">
              Proceed to Connect Broker &rarr;
            </Link>
          </div>
        )}

        {txStatus === 'failed' && error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-1.5">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-400" />
              <p className="text-xs font-bold">Payment Unsuccessful</p>
            </div>
            <p className="text-[11px] text-rose-300/80">{error}</p>
            <button onClick={resetForm} className="text-xs font-bold underline cursor-pointer">
              Try Again
            </button>
          </div>
        )}

        {/* Payment Form Inputs */}
        {(txStatus === 'idle' || txStatus === 'waiting') && (
          <form onSubmit={handleSubscribe} className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.05]">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Total:</span>
              <span className="text-xl font-black text-emerald-400 font-mono">
                UGX {PACKAGES.find(p => p.id === selectedPlan)?.price.toLocaleString()}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                Mobile Money Number (MTN / Airtel)
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 flex items-center gap-1.5 pointer-events-none text-slate-400 font-mono text-xs border-r border-white/10 pr-2.5">
                  <span>🇺🇬</span>
                  <span className="font-bold text-slate-300">+256</span>
                </div>
                <input
                  id="subscribe-phone-input"
                  type="tel"
                  required
                  placeholder="770 123 456"
                  disabled={txStatus === 'waiting'}
                  className="w-full pl-24 pr-4 py-3.5 bg-slate-950/70 border border-white/10 rounded-2xl text-white font-mono text-sm font-semibold focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all placeholder:text-slate-600 disabled:opacity-50"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
            </div>

            <button
              id="subscribe-submit-button"
              type="submit"
              disabled={loading || txStatus === 'waiting'}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Sending Mobile Money Prompt...</span>
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4" />
                  <span>Pay UGX {PACKAGES.find(p => p.id === selectedPlan)?.price.toLocaleString()} via Investio</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
