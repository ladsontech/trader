import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BROKERS } from '../lib/constants';
import {
  Wifi,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Unplug,
} from 'lucide-react';
import { Link } from 'react-router';

export default function ConnectBroker() {
  const { userData, user, refreshUserData } = useAuth();
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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

    // Validate all fields filled
    for (const field of broker.fields) {
      if (!formData[field.key]?.trim()) {
        setError(`Please enter your ${field.label}`);
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      // Store broker connection in Firestore
      const userRef = doc(db, 'tradebot_users', user.uid);
      await updateDoc(userRef, {
        broker: broker.name,
        brokerId: broker.id,
        brokerConnected: true,
        brokerAccountId: formData.accountId || '',
        brokerServer: formData.server || '',
        brokerConnectedAt: new Date(),
      });

      setSuccess(true);
      await refreshUserData();
    } catch (err: any) {
      console.error('Failed to connect broker:', err);
      setError(err.message || 'Failed to connect broker. Please try again.');
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
      setSuccess(false);
      setSelectedBroker(null);
      setFormData({});
      await refreshUserData();
    } catch (err: any) {
      console.error('Failed to disconnect broker:', err);
    } finally {
      setLoading(false);
    }
  };

  // Not subscribed
  if (!isSubscribed) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Connect Broker</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Link your trading account.</p>
        </div>
        <div className="glass-card p-6 sm:p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-amber-dim)] flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-[var(--accent-amber)]" />
          </div>
          <h2 className="text-lg font-black">Subscription Required</h2>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            You need an active subscription to connect a broker. Subscribe to a plan first.
          </p>
          <Link to="/subscribe" className="btn-primary inline-flex !w-auto px-6">
            View Plans <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Already connected
  if (isBrokerConnected && !success) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Broker Connection</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Your connected broker account.</p>
        </div>
        <div className="glass-card p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent-emerald-dim)] flex items-center justify-center">
              <Wifi className="w-7 h-7 text-[var(--accent-emerald)]" />
            </div>
            <div>
              <h2 className="text-lg font-black">{userData?.broker || 'Broker'}</h2>
              <div className="badge-active mt-1">Connected</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Broker</span>
              <span className="font-bold">{userData?.broker}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">Status</span>
              <span className="font-bold text-[var(--accent-emerald)]">Active</span>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <Shield className="w-4 h-4 text-[var(--accent-blue)] mt-0.5 shrink-0" />
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
              Your credentials are stored securely. The bot uses read-only access to place trades on your behalf.
            </p>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="btn-secondary text-xs !text-[var(--accent-rose)]"
          >
            <Unplug className="w-3.5 h-3.5" />
            Disconnect Broker
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Connect Broker</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Link your trading account to start automated trading.
        </p>
      </div>

      {/* Success State */}
      {success && (
        <div className="glass-card p-6 sm:p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-emerald-dim)] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-[var(--accent-emerald)]" />
          </div>
          <h2 className="text-lg font-black">Broker Connected!</h2>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            Your {BROKERS.find((b) => b.id === selectedBroker)?.name} account has been connected.
            The bot will start analyzing the market and placing trades.
          </p>
          <Link to="/" className="btn-primary inline-flex !w-auto px-6">
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Broker Selection */}
      {!success && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {BROKERS.map((broker) => (
              <button
                key={broker.id}
                type="button"
                onClick={() => {
                  setSelectedBroker(broker.id);
                  setFormData({});
                  setError('');
                }}
                className={`glass-card p-4 sm:p-5 text-left cursor-pointer transition-all ${
                  selectedBroker === broker.id
                    ? '!border-[var(--accent-blue)] shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                    : ''
                }`}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-black mb-3"
                  style={{ backgroundColor: broker.color + '20', color: broker.color }}
                >
                  {broker.logo}
                </div>
                <h3 className="text-sm font-black mb-1">{broker.name}</h3>
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">{broker.description}</p>
              </button>
            ))}
          </div>

          {/* Connection Form */}
          {selectedBroker && (
            <div className="glass-card p-5 sm:p-7">
              <h3 className="text-sm font-bold mb-1">
                Connect {BROKERS.find((b) => b.id === selectedBroker)?.name}
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] mb-5">
                Enter your broker account credentials below.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-[var(--accent-rose-dim)] border border-rose-500/20 text-xs text-[var(--accent-rose)] font-semibold">
                  {error}
                </div>
              )}

              <form onSubmit={handleConnect} className="space-y-4">
                {BROKERS.find((b) => b.id === selectedBroker)?.fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-[10px] font-bold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
                      {field.label}
                    </label>
                    <input
                      id={`broker-${field.key}-input`}
                      type={field.type}
                      required
                      placeholder={field.placeholder}
                      className="input-dark !pl-4"
                      value={formData[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    />
                  </div>
                ))}

                <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
                  <Shield className="w-4 h-4 text-[var(--accent-blue)] mt-0.5 shrink-0" />
                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                    Your credentials are encrypted and used solely for trade execution. We never share your data.
                  </p>
                </div>

                <button
                  id="broker-connect-button"
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wifi className="w-4 h-4" />
                      Connect {BROKERS.find((b) => b.id === selectedBroker)?.name}
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
