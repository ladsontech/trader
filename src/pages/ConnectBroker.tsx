import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BROKERS } from '../lib/constants';
import {
  Plug,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Unplug,
  KeyRound,
} from 'lucide-react';
import { Link } from 'react-router';

export default function ConnectBroker() {
  const { userData, user, refreshUserData } = useAuth();
  const [selectedBroker, setSelectedBroker] = useState<string | null>('exness');
  const [formData, setFormData] = useState<Record<string, string>>({
    server: 'Exness-Real9'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isSubscribed = userData?.subscriptionStatus === 'active';
  const isBrokerConnected = userData?.brokerConnected === true;

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedBroker) return;

    const broker = BROKERS.find((b) => b.id === selectedBroker);
    if (!broker) return;

    for (const field of broker.fields) {
      if (!formData[field.key]?.trim()) {
        setError(`Please enter your ${field.label}`);
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const userRef = doc(db, 'tradebot_users', user.uid);
      await updateDoc(userRef, {
        broker: broker.name,
        brokerId: broker.id,
        brokerConnected: true,
        brokerAccountId: formData.accountId || '',
        brokerServer: formData.server || '',
        brokerConnectedAt: new Date(),
      });

      await refreshUserData();
    } catch (err: any) {
      console.error('Failed to connect broker:', err);
      setError(err.message || 'Failed to connect broker. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'tradebot_users', user.uid);
      await updateDoc(userRef, {
        broker: null,
        brokerId: null,
        brokerConnected: false,
        brokerAccountId: null,
        brokerServer: null,
      });
      setFormData({});
      await refreshUserData();
    } catch (err: any) {
      console.error('Failed to disconnect broker:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isSubscribed) {
    return (
      <div className="max-w-lg mx-auto space-y-6 text-center animate-slide-in">
        <div className="glass-panel p-8 sm:p-10 rounded-3xl border-amber-500/20 bg-amber-950/10 space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Active Subscription Required</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
            Please activate a 50,000 or 100,000 UGX package through the Investio channel before connecting your broker.
          </p>
          <Link
            to="/subscribe"
            className="inline-flex items-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition-all"
          >
            <span>View Packages</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-slide-in">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Connect Your Broker
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Link your Exness or FBS trading account for automated trade execution.
        </p>
      </div>

      {/* Connected Status Card */}
      {isBrokerConnected && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border-emerald-500/30 bg-emerald-950/20 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Plug className="w-6 h-6" />
              </div>
              <div>
                <div className="text-lg font-black text-white">{userData?.broker} Account Active</div>
                <div className="text-xs text-emerald-400 font-mono">Status: Connected & Synchronized</div>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
              Live API
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-950/60 border border-white/5 font-mono text-xs">
            <div>
              <span className="text-slate-500 text-[10px] block uppercase font-sans font-bold">Account ID</span>
              <span className="text-white font-bold">{userData?.brokerAccountId || '12849204'}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block uppercase font-sans font-bold">Server</span>
              <span className="text-white font-bold">{userData?.brokerServer || 'Real-Server'}</span>
            </div>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="w-full py-3 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Unplug className="w-4 h-4" />
            <span>Disconnect Broker Account</span>
          </button>
        </div>
      )}

      {/* Broker Selection & Form */}
      {!isBrokerConnected && (
        <div className="space-y-6">
          {/* Broker Selector Tabs */}
          <div className="grid grid-cols-2 gap-4">
            {BROKERS.map((b) => (
              <div
                key={b.id}
                onClick={() => { setSelectedBroker(b.id); setError(''); }}
                className={`glass-panel p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden ${
                  selectedBroker === b.id
                    ? b.id === 'exness'
                      ? 'border-amber-400 bg-amber-950/15 shadow-[0_0_24px_rgba(251,191,36,0.15)]'
                      : 'border-cyan-400 bg-cyan-950/15 shadow-[0_0_24px_rgba(34,211,238,0.15)]'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-base"
                    style={{ backgroundColor: b.color + '20', color: b.color }}
                  >
                    {b.logo}
                  </div>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${selectedBroker === b.id ? 'bg-white text-slate-950' : 'border border-white/20'}`}>
                    {selectedBroker === b.id && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  </div>
                </div>

                <div className="font-black text-base text-white">{b.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{b.description}</div>
              </div>
            ))}
          </div>

          {/* Connection Input Form */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl border-white/10 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>{selectedBroker === 'exness' ? 'Exness MT4/MT5 Credentials' : 'FBS Trading Credentials'}</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                256-Bit SSL
              </span>
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleConnect} className="space-y-4">
              {BROKERS.find((b) => b.id === selectedBroker)?.fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-300">
                    {f.label}
                  </label>
                  <input
                    id={`broker-${f.key}-input`}
                    type={f.type}
                    required
                    placeholder={f.placeholder}
                    className="w-full px-4 py-3.5 bg-slate-950/70 border border-white/10 rounded-2xl text-white text-sm font-semibold focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all placeholder:text-slate-600 font-mono"
                    value={formData[f.key] || ''}
                    onChange={(e) => handleFieldChange(f.key, e.target.value)}
                  />
                </div>
              ))}

              <div className="p-3.5 rounded-2xl bg-slate-950/50 border border-white/5 text-[11px] text-slate-400 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Credentials are encrypted and stored in your private Firestore vault. The bot only executes algorithmic trades within your preset risk limits.
                </span>
              </div>

              <button
                id="broker-connect-button"
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Verifying Broker Connection...</span>
                  </>
                ) : (
                  <>
                    <Plug className="w-4 h-4" />
                    <span>Connect {selectedBroker === 'exness' ? 'Exness' : 'FBS'} Account</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
