import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/auth-context';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, app } from '../lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { PACKAGES } from '../lib/constants';
import {
  CheckCircle2,
  Phone,
  Loader2,
  XCircle,
  Crown,
  Sparkles,
  Check,
  Bot,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router';

const functions = getFunctions(app);

const pendingSubStorageKey = (uid: string) => `tradebot.pendingSub.${uid}`;

export default function Subscribe() {
  const { userData, user, refreshUserData } = useAuth();
  const submittingRef = useRef(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [txStatus, setTxStatus] = useState<'idle' | 'waiting' | 'completed' | 'failed'>('idle');
  const [currentReference, setCurrentReference] = useState<string | null>(null);

  const isSubscribed = userData?.subscriptionStatus === 'active';

  // Restore pending subscription
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

  // Listen for payment status
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
            // Update tradebot user subscription
            const plan = selectedPlan || 'standard';
            const userRef = doc(db, 'tradebot_users', user!.uid);
            updateDoc(userRef, {
              subscriptionPlan: plan,
              subscriptionStatus: 'active',
              subscriptionExpiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
            }).then(() => refreshUserData());
          } else if (data.status === 'failed') {
            setTxStatus('failed');
            setError(data.failureReason || 'Payment failed. Please try again.');
            setLoading(false);
            if (user) localStorage.removeItem(pendingSubStorageKey(user.uid));
          }
        }
      },
      (snapshotError) => {
        console.error('Subscription status listener failed:', snapshotError);
        setError('Unable to monitor payment status. Please refresh.');
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

    if (!phoneNumber || phoneNumber.replace(/\D/g, '').length < 9) {
      setError('Please enter a valid phone number');
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError('');
    setTxStatus('waiting');

    try {
      // Use Investio's existing initiateDeposit function
      const initiateDeposit = httpsCallable(functions, 'initiateDeposit');
      const result = await initiateDeposit({
        phoneNumber,
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
        setError(
          data.reused
            ? data.message || 'An active payment request is already pending.'
            : ''
        );
        setCurrentReference(data.reference);
      } else {
        setError('Failed to initiate payment. Please try again.');
        setLoading(false);
        setTxStatus('failed');
      }
    } catch (err: any) {
      console.error('Subscription payment failed:', err);
      setError(err.message || 'Failed to initiate payment. Please try again.');
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
    setPhoneNumber('');
    setLoading(false);
    if (user) localStorage.removeItem(pendingSubStorageKey(user.uid));
  };

  const cancelWaiting = () => {
    setTxStatus('idle');
    setCurrentReference(null);
    setError('If you canceled on your phone, wait a moment before trying again.');
    setLoading(false);
    if (user) localStorage.removeItem(pendingSubStorageKey(user.uid));
  };

  // Already subscribed
  if (isSubscribed) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Subscription</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Your current plan details.</p>
        </div>
        <div className="glass-card p-6 sm:p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-emerald-dim)] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-[var(--accent-emerald)]" />
          </div>
          <h2 className="text-lg font-black">You're Subscribed!</h2>
          <div className="badge-active mx-auto">
            {userData?.subscriptionPlan === 'premium' ? 'Premium' : 'Standard'} Plan — Active
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Your subscription is active. Head to the broker page to connect your trading account.
          </p>
          <Link to="/broker" className="btn-primary inline-flex !w-auto px-6">
            Connect Broker <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Subscribe</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Choose a plan and pay via mobile money to activate the trading bot.
        </p>
      </div>

      {/* Plan Selection */}
      <div className="grid sm:grid-cols-2 gap-4">
        {PACKAGES.map((pkg) => (
          <button
            key={pkg.id}
            type="button"
            onClick={() => setSelectedPlan(pkg.id)}
            disabled={txStatus === 'waiting'}
            className={`glass-card p-5 sm:p-6 text-left cursor-pointer transition-all relative overflow-hidden ${
              selectedPlan === pkg.id
                ? '!border-[var(--accent-blue)] shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                : ''
            }`}
          >
            {pkg.recommended && (
              <div className="absolute top-3 right-3">
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] text-[9px] font-black uppercase tracking-wider">
                  <Sparkles className="w-3 h-3" /> Recommended
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                pkg.id === 'premium'
                  ? 'bg-gradient-to-br from-[var(--accent-purple)] to-[var(--accent-blue)] shadow-lg shadow-purple-500/20'
                  : 'bg-gradient-to-br from-[var(--accent-blue)] to-[#2563EB] shadow-lg shadow-blue-500/20'
              }`}>
                {pkg.id === 'premium' ? (
                  <Crown className="w-5 h-5 text-white" />
                ) : (
                  <Bot className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-black">{pkg.name}</h3>
                <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-wider">{pkg.badge}</p>
              </div>
            </div>

            <div className="mb-4">
              <span className="text-2xl font-black">UGX {pkg.price.toLocaleString()}</span>
              <span className="text-xs text-[var(--text-muted)] font-semibold"> /month</span>
            </div>

            <ul className="space-y-2">
              {pkg.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
                  <Check className="w-3.5 h-3.5 text-[var(--accent-emerald)] mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {selectedPlan === pkg.id && (
              <div className="absolute bottom-3 right-3">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-blue)] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Payment Section */}
      {selectedPlan && (
        <div className="glass-card p-5 sm:p-7">
          {/* Payment Statuses */}
          {txStatus === 'waiting' && (
            <div className="mb-5 p-4 rounded-xl bg-[var(--accent-amber-dim)] border border-amber-500/20 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-[var(--accent-amber)] animate-spin shrink-0" />
              <div>
                <p className="text-xs font-bold text-[var(--accent-amber)]">Waiting for payment...</p>
                <p className="text-[10px] text-amber-300/70 mt-0.5">
                  Approve the mobile money prompt on your phone.
                </p>
                {error && <p className="text-[10px] text-amber-300/70 mt-1">{error}</p>}
              </div>
            </div>
          )}

          {txStatus === 'completed' && (
            <div className="mb-5 space-y-3">
              <div className="p-4 rounded-xl bg-[var(--accent-emerald-dim)] border border-emerald-500/20 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-[var(--accent-emerald)] shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[var(--accent-emerald)]">Subscription activated!</p>
                  <p className="text-[10px] text-emerald-300/70 mt-0.5">
                    Your {selectedPlan === 'premium' ? 'Premium' : 'Standard'} plan is now active.
                  </p>
                </div>
              </div>
              <Link to="/broker" className="btn-primary">
                Connect Your Broker <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {txStatus === 'failed' && error && (
            <div className="mb-5 space-y-3">
              <div className="p-4 rounded-xl bg-[var(--accent-rose-dim)] border border-rose-500/20 flex items-center gap-3">
                <XCircle className="w-5 h-5 text-[var(--accent-rose)] shrink-0" />
                <p className="text-xs font-semibold text-[var(--accent-rose)]">{error}</p>
              </div>
              <button onClick={resetForm} className="btn-secondary text-xs">Try Again</button>
            </div>
          )}

          {txStatus === 'idle' && error && (
            <div className="mb-5 p-4 rounded-xl bg-[var(--accent-rose-dim)] border border-rose-500/20 text-xs text-[var(--accent-rose)] font-semibold">
              {error}
            </div>
          )}

          {/* Payment Form */}
          {(txStatus === 'idle' || txStatus === 'waiting') && (
            <form onSubmit={handleSubscribe} className="space-y-5">
              <div>
                <h3 className="text-sm font-bold mb-1">Pay via Mobile Money</h3>
                <p className="text-[10px] text-[var(--text-muted)]">
                  UGX {PACKAGES.find((p) => p.id === selectedPlan)?.price.toLocaleString()} for the{' '}
                  {selectedPlan === 'premium' ? 'Premium' : 'Standard'} plan.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
                  Mobile Money Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    id="subscribe-phone-input"
                    type="tel"
                    required
                    placeholder="e.g. 0770123456"
                    className="input-dark"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    disabled={txStatus === 'waiting'}
                  />
                </div>
                <p className="text-[9px] text-[var(--text-muted)] mt-1 ml-1">MTN or Airtel Uganda number</p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  id="subscribe-submit-button"
                  type="submit"
                  disabled={loading || txStatus === 'waiting'}
                  className="btn-primary"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Pay UGX ${PACKAGES.find((p) => p.id === selectedPlan)?.price.toLocaleString()}`
                  )}
                </button>

                {txStatus === 'waiting' && (
                  <button
                    type="button"
                    onClick={cancelWaiting}
                    className="btn-secondary text-xs !bg-[var(--accent-rose-dim)] !text-[var(--accent-rose)] !border-rose-500/20"
                  >
                    Cancel waiting
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
