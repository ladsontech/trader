import { useAuth } from '../lib/auth-context';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  User,
  Bot,
  Wifi,
  WifiOff,
  LogOut,
  Crown,
  Calendar,
  Phone,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router';

export default function Settings() {
  const { userData, user } = useAuth();

  const isSubscribed = userData?.subscriptionStatus === 'active';
  const isBrokerConnected = userData?.brokerConnected === true;

  const handleLogout = () => {
    signOut(auth);
  };

  const phoneDisplay = userData?.phoneDigits || user?.email?.split('@')[0] || 'N/A';
  const planName = userData?.subscriptionPlan === 'premium' ? 'Premium Bot' : userData?.subscriptionPlan === 'standard' ? 'Standard Bot' : 'No Plan';

  const expiresAt = userData?.subscriptionExpiresAt
    ? new Date(userData.subscriptionExpiresAt).toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Manage your account and preferences.</p>
      </div>

      {/* Profile Card */}
      <div className="glass-card p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-purple)] flex items-center justify-center shadow-lg shadow-blue-500/10">
            <User className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-base font-black">{phoneDisplay}</h2>
            <div className="flex items-center gap-2 mt-1">
              {isSubscribed ? (
                <div className="badge-active">{planName}</div>
              ) : (
                <div className="badge-inactive">No Subscription</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Account</h3>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-[var(--text-muted)]" />
              <div>
                <p className="text-xs font-bold">Phone Number</p>
                <p className="text-[10px] text-[var(--text-muted)]">{phoneDisplay}</p>
              </div>
            </div>
          </div>

          <Link
            to="/subscribe"
            className="flex items-center justify-between px-5 py-4 hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            <div className="flex items-center gap-3">
              {isSubscribed ? (
                <Crown className="w-4 h-4 text-[var(--accent-amber)]" />
              ) : (
                <Bot className="w-4 h-4 text-[var(--text-muted)]" />
              )}
              <div>
                <p className="text-xs font-bold">Subscription</p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {isSubscribed ? planName : 'Not subscribed'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </Link>

          {isSubscribed && expiresAt && (
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-[var(--text-muted)]" />
                <div>
                  <p className="text-xs font-bold">Expires</p>
                  <p className="text-[10px] text-[var(--text-muted)]">{expiresAt}</p>
                </div>
              </div>
            </div>
          )}

          <Link
            to="/broker"
            className="flex items-center justify-between px-5 py-4 hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            <div className="flex items-center gap-3">
              {isBrokerConnected ? (
                <Wifi className="w-4 h-4 text-[var(--accent-emerald)]" />
              ) : (
                <WifiOff className="w-4 h-4 text-[var(--text-muted)]" />
              )}
              <div>
                <p className="text-xs font-bold">Broker</p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {isBrokerConnected ? `${userData?.broker} — Connected` : 'Not connected'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </Link>
        </div>
      </div>

      {/* Sign Out */}
      <button
        id="settings-logout-button"
        onClick={handleLogout}
        className="btn-secondary !text-[var(--accent-rose)] group w-full"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>

      <p className="text-center text-[9px] text-[var(--text-muted)] opacity-50">
        TradeBot v1.0.0 &bull; Powered by Investio
      </p>
    </div>
  );
}
