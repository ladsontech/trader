import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';
import { Card, SectionTitle, StatusDot, cx } from '../components/ui';
import {
  Bot,
  CheckCircle2,
  Clock,
  CreditCard,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
  Zap,
} from 'lucide-react';

interface UserRecord {
  id: string;
  phoneDigits?: string;
  country?: 'UG' | 'KE';
  currency?: 'UGX' | 'KES';
  subscriptionPlan?: 'standard' | 'premium' | null;
  subscriptionStatus?: 'active' | 'expired' | 'none';
  subscriptionExpiresAt?: number;
  subscriptionActivatedAt?: number;
  broker?: string | null;
  brokerConnected?: boolean;
  brokerAccountId?: string | null;
  brokerServer?: string | null;
  botEnabled?: boolean;
  onboardedAt?: number;
  isAdmin?: boolean;
  createdAt?: any;
}

interface TransactionRecord {
  id: string;
  reference?: string;
  userId?: string;
  phoneNumber?: string;
  amount?: number;
  currency?: string;
  planId?: string;
  status?: 'completed' | 'pending' | 'failed';
  provider?: string;
  paymentMethod?: string;
  createdAt?: any;
  completedAt?: any;
  failureReason?: string;
}

export default function Admin() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingTx, setLoadingTx] = useState(true);

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'deposits'>('overview');

  // Filters for Users tab
  const [userSearch, setUserSearch] = useState('');
  const [userCountryFilter, setUserCountryFilter] = useState<'ALL' | 'UG' | 'KE'>('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState<'ALL' | 'active' | 'expired' | 'none'>('ALL');

  // Filters for Deposits tab
  const [txSearch, setTxSearch] = useState('');
  const [txStatusFilter, setTxStatusFilter] = useState<'ALL' | 'completed' | 'pending' | 'failed'>('ALL');
  const [txCurrencyFilter, setTxCurrencyFilter] = useState<'ALL' | 'UGX' | 'KES'>('ALL');

  // Real-time listener for users
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'tradebot_users'),
      (snap) => {
        const list: UserRecord[] = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setUsers(list);
        setLoadingUsers(false);
      },
      (err) => {
        console.error('Error fetching tradebot users:', err);
        setLoadingUsers(false);
      }
    );
    return () => unsub();
  }, []);

  // Real-time listener for transactions
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'tradebot_transactions'),
      (snap) => {
        const list: TransactionRecord[] = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        // Sort newest first
        list.sort((a, b) => {
          const timeA = toMillis(a.createdAt);
          const timeB = toMillis(b.createdAt);
          return timeB - timeA;
        });
        setTransactions(list);
        setLoadingTx(false);
      },
      (err) => {
        console.error('Error fetching tradebot transactions:', err);
        setLoadingTx(false);
      }
    );
    return () => unsub();
  }, []);

  const toMillis = (timestamp: any): number => {
    if (!timestamp) return 0;
    if (typeof timestamp.toMillis === 'function') return timestamp.toMillis();
    if (typeof timestamp.getTime === 'function') return timestamp.getTime();
    if (typeof timestamp === 'number') return timestamp;
    const parsed = Date.parse(timestamp);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatDate = (timestamp: any): string => {
    const ms = toMillis(timestamp);
    if (!ms) return '—';
    return new Date(ms).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // ── Metrics Calculations ──────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalSignups = users.length;
    const ugSignups = users.filter((u) => u.country !== 'KE').length;
    const keSignups = users.filter((u) => u.country === 'KE').length;

    const activeSubs = users.filter(
      (u) =>
        u.subscriptionStatus === 'active' &&
        (Number(u.subscriptionExpiresAt) || 0) > Date.now()
    );
    const expiredSubs = users.filter(
      (u) =>
        u.subscriptionStatus === 'expired' ||
        (u.subscriptionStatus === 'active' &&
          (Number(u.subscriptionExpiresAt) || 0) <= Date.now())
    );
    const standardSubs = users.filter((u) => u.subscriptionPlan === 'standard');
    const premiumSubs = users.filter((u) => u.subscriptionPlan === 'premium');

    const connectedBrokers = users.filter((u) => u.brokerConnected);
    const activeBots = users.filter((u) => u.botEnabled);

    // Completed deposits
    const completedTxs = transactions.filter(
      (tx) => tx.status === 'completed' || (!tx.status && (tx.amount || 0) > 0)
    );
    const pendingTxs = transactions.filter((tx) => tx.status === 'pending');
    const failedTxs = transactions.filter((tx) => tx.status === 'failed');

    let totalUgx = 0;
    let totalKes = 0;

    for (const tx of completedTxs) {
      const amount = Number(tx.amount) || 0;
      const curr = (tx.currency || 'UGX').toUpperCase();
      if (curr === 'KES') {
        totalKes += amount;
      } else {
        totalUgx += amount;
      }
    }

    return {
      totalSignups,
      ugSignups,
      keSignups,
      activeSubs: activeSubs.length,
      expiredSubs: expiredSubs.length,
      standardSubs: standardSubs.length,
      premiumSubs: premiumSubs.length,
      connectedBrokers: connectedBrokers.length,
      activeBots: activeBots.length,
      totalUgx,
      totalKes,
      totalCompletedCount: completedTxs.length,
      totalPendingCount: pendingTxs.length,
      totalFailedCount: failedTxs.length,
    };
  }, [users, transactions]);

  // ── Filtered Users ────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const phone = (u.phoneDigits || u.id || '').toLowerCase();
      if (userSearch && !phone.includes(userSearch.toLowerCase())) {
        return false;
      }
      if (userCountryFilter !== 'ALL') {
        const uCountry = u.country || 'UG';
        if (uCountry !== userCountryFilter) return false;
      }
      if (userStatusFilter !== 'ALL') {
        const isAct =
          u.subscriptionStatus === 'active' &&
          (Number(u.subscriptionExpiresAt) || 0) > Date.now();
        if (userStatusFilter === 'active' && !isAct) return false;
        if (
          userStatusFilter === 'expired' &&
          (u.subscriptionStatus !== 'expired' && isAct)
        )
          return false;
        if (userStatusFilter === 'none' && (u.subscriptionStatus === 'active' || u.subscriptionStatus === 'expired'))
          return false;
      }
      return true;
    });
  }, [users, userSearch, userCountryFilter, userStatusFilter]);

  // ── Filtered Transactions ─────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const ref = (tx.reference || tx.id || '').toLowerCase();
      const phone = (tx.phoneNumber || '').toLowerCase();
      const search = txSearch.toLowerCase();

      if (txSearch && !ref.includes(search) && !phone.includes(search)) {
        return false;
      }
      if (txStatusFilter !== 'ALL') {
        const status = tx.status || 'pending';
        if (status !== txStatusFilter) return false;
      }
      if (txCurrencyFilter !== 'ALL') {
        const curr = (tx.currency || 'UGX').toUpperCase();
        if (curr !== txCurrencyFilter) return false;
      }
      return true;
    });
  }, [transactions, txSearch, txStatusFilter, txCurrencyFilter]);

  const isLoading = loadingUsers || loadingTx;

  if (!isAdmin) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="h-12 w-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-400">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-ink">Access Restricted</h2>
        <p className="text-xs text-ink-soft max-w-sm mx-auto">
          This portal is reserved for TradeBot system administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-accent-soft border border-accent/25 flex items-center justify-center">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            </div>
            <span className="chip text-[11px] font-semibold text-accent">Admin Portal</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink mt-1.5">
            TradeBot Master Admin
          </h1>
          <p className="text-xs text-ink-soft mt-0.5">
            Real-time analytics for total deposits, revenue, and registered user sign-ups.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="btn btn-ghost text-xs flex items-center gap-1.5 h-8.5 px-3"
            title="Refresh Data"
          >
            <RefreshCw className={cx('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Sign-ups */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Total Sign-ups
            </span>
            <div className="h-7 w-7 rounded-lg bg-surface-2 flex items-center justify-center text-ink-soft">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="tnum text-2xl sm:text-3xl font-extrabold text-ink mt-2">
            {metrics.totalSignups}
          </p>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-ink-faint">
            <span>🇺🇬 {metrics.ugSignups} UG</span>
            <span>·</span>
            <span>🇰🇪 {metrics.keSignups} KE</span>
          </div>
        </Card>

        {/* Total UGX Deposits */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Total UGX Deposits
            </span>
            <div className="h-7 w-7 rounded-lg bg-accent-soft flex items-center justify-center text-accent">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="tnum text-2xl sm:text-3xl font-extrabold text-ink mt-2">
            UGX {metrics.totalUgx.toLocaleString()}
          </p>
          <p className="text-[11px] text-ink-faint mt-2">
            Mobile Money Collected
          </p>
        </Card>

        {/* Total KES Deposits */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Total KES Deposits
            </span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="tnum text-2xl sm:text-3xl font-extrabold text-ink mt-2">
            KES {metrics.totalKes.toLocaleString()}
          </p>
          <p className="text-[11px] text-ink-faint mt-2">
            M-Pesa Kenya Collected
          </p>
        </Card>

        {/* Active Subscriptions */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Active Bots
            </span>
            <div className="h-7 w-7 rounded-lg bg-surface-2 flex items-center justify-center text-ink-soft">
              <Bot className="h-4 w-4 text-emerald-400" />
            </div>
          </div>
          <p className="tnum text-2xl sm:text-3xl font-extrabold text-ink mt-2">
            {metrics.activeSubs}
          </p>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-ink-faint">
            <span>{metrics.connectedBrokers} Brokers Connected</span>
          </div>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-line gap-2 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={cx(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer',
            activeTab === 'overview'
              ? 'border-accent text-accent'
              : 'border-transparent text-ink-soft hover:text-ink'
          )}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Overview & Revenue</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={cx(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer',
            activeTab === 'users'
              ? 'border-accent text-accent'
              : 'border-transparent text-ink-soft hover:text-ink'
          )}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Total Sign-ups ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('deposits')}
          className={cx(
            'flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer',
            activeTab === 'deposits'
              ? 'border-accent text-accent'
              : 'border-transparent text-ink-soft hover:text-ink'
          )}
        >
          <CreditCard className="h-3.5 w-3.5" />
          <span>Deposits & Ledger ({transactions.length})</span>
        </button>
      </div>

      {/* ── Tab 1: Overview ────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plan Subscription Breakdown */}
            <Card className="p-5 space-y-4">
              <SectionTitle
                title="Subscriptions by Plan"
                subtitle="Distribution of Standard and VIP Premium subscribers."
              />
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-line">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ink">Standard Bot</p>
                      <p className="text-[11px] text-ink-soft">UGX 50,000 / KES 1,800</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-sm font-bold text-ink">{metrics.standardSubs}</p>
                    <p className="text-[10px] text-ink-faint">users</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-line">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ink">VIP Premium Bot</p>
                      <p className="text-[11px] text-ink-soft">UGX 100,000 / KES 3,500</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-sm font-bold text-ink">{metrics.premiumSubs}</p>
                    <p className="text-[10px] text-ink-faint">users</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Deposit Health Breakdown */}
            <Card className="p-5 space-y-4">
              <SectionTitle
                title="Deposit Status Breakdown"
                subtitle="Transaction execution summary from gateway."
              />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                  <p className="tnum text-lg font-bold text-ink mt-1">
                    {metrics.totalCompletedCount}
                  </p>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mt-0.5">
                    Completed
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <Clock className="h-4 w-4 text-amber-400 mx-auto" />
                  <p className="tnum text-lg font-bold text-ink mt-1">
                    {metrics.totalPendingCount}
                  </p>
                  <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mt-0.5">
                    Pending
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <XCircle className="h-4 w-4 text-rose-400 mx-auto" />
                  <p className="tnum text-lg font-bold text-ink mt-1">
                    {metrics.totalFailedCount}
                  </p>
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mt-0.5">
                    Failed
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-line text-[11px] text-ink-soft space-y-1.5">
                <div className="flex justify-between">
                  <span>Total Transactions Logged:</span>
                  <span className="font-bold text-ink">{transactions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Brokers Live Trading:</span>
                  <span className="font-bold text-emerald-400">{metrics.activeBots}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent 5 Sign-ups Quick View */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle
                title="Recent Sign-ups"
                subtitle="The latest users registered on TradeBot."
              />
              <button
                onClick={() => setActiveTab('users')}
                className="text-xs font-bold text-accent hover:underline cursor-pointer"
              >
                View all →
              </button>
            </div>

            {users.length === 0 ? (
              <p className="text-xs text-ink-soft py-4 text-center">No sign-ups registered yet.</p>
            ) : (
              <div className="divide-y divide-line">
                {users.slice(0, 5).map((u) => (
                  <div key={u.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="chip text-[10px]">
                        {u.country === 'KE' ? '🇰🇪' : '🇺🇬'}
                      </span>
                      <div>
                        <p className="font-bold text-ink tnum">{u.phoneDigits || u.id.slice(0, 8)}</p>
                        <p className="text-[10px] text-ink-soft">
                          Joined {formatDate(u.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div>
                      {u.subscriptionStatus === 'active' ? (
                        <span className="chip text-[10px] text-emerald-400 border-emerald-500/25">
                          Active · {u.subscriptionPlan || 'Bot'}
                        </span>
                      ) : (
                        <span className="chip text-[10px] text-ink-faint">Unsubscribed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Tab 2: Total Sign-ups (Users Directory) ───────────────────── */}
      {activeTab === 'users' && (
        <Card className="p-5 space-y-4">
          <SectionTitle
            title="Registered Users Directory"
            subtitle="Full listing of all accounts registered on TradeBot."
          />

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input
                type="text"
                placeholder="Search by phone number or UID…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="input pl-9 text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={userCountryFilter}
                onChange={(e) => setUserCountryFilter(e.target.value as any)}
                className="input text-xs h-9 px-2.5 w-32"
              >
                <option value="ALL">All Regions</option>
                <option value="UG">Uganda (UGX)</option>
                <option value="KE">Kenya (KES)</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value as any)}
                className="input text-xs h-9 px-2.5 w-36"
              >
                <option value="ALL">All Statuses</option>
                <option value="active">Active Sub</option>
                <option value="expired">Expired</option>
                <option value="none">No Plan</option>
              </select>
            </div>
          </div>

          {/* User count badge */}
          <p className="text-[11px] text-ink-soft">
            Showing <strong className="text-ink">{filteredUsers.length}</strong> of{' '}
            <strong className="text-ink">{users.length}</strong> registered users.
          </p>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-ink-soft text-[10px] uppercase font-bold tracking-wider border-b border-line">
                <tr>
                  <th className="px-3.5 py-2.5">Phone / User</th>
                  <th className="px-3.5 py-2.5">Region</th>
                  <th className="px-3.5 py-2.5">Subscription</th>
                  <th className="px-3.5 py-2.5">Broker MT5</th>
                  <th className="px-3.5 py-2.5">Bot Status</th>
                  <th className="px-3.5 py-2.5">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-ink-soft">
                      No matching users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isAct =
                      u.subscriptionStatus === 'active' &&
                      (Number(u.subscriptionExpiresAt) || 0) > Date.now();

                    return (
                      <tr key={u.id} className="hover:bg-surface/50 transition-colors">
                        <td className="px-3.5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold tnum">
                              {u.phoneDigits || 'Unknown'}
                            </span>
                            {u.isAdmin && (
                              <span className="chip text-[9px] text-accent border-accent/30">
                                Admin
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-ink-faint font-mono">
                            {u.id.slice(0, 10)}…
                          </span>
                        </td>

                        <td className="px-3.5 py-3">
                          <span className="chip text-[11px]">
                            {u.country === 'KE' ? '🇰🇪 Kenya' : '🇺🇬 Uganda'}
                          </span>
                        </td>

                        <td className="px-3.5 py-3">
                          {isAct ? (
                            <div>
                              <span className="chip text-[10px] font-bold text-emerald-400 border-emerald-500/25">
                                Active · {u.subscriptionPlan || 'Bot'}
                              </span>
                              {u.subscriptionExpiresAt && (
                                <p className="text-[10px] text-ink-faint mt-0.5">
                                  Exp: {formatDate(u.subscriptionExpiresAt)}
                                </p>
                              )}
                            </div>
                          ) : u.subscriptionStatus === 'expired' ? (
                            <span className="chip text-[10px] text-amber-400 border-amber-500/25">
                              Expired
                            </span>
                          ) : (
                            <span className="chip text-[10px] text-ink-faint">
                              No Plan
                            </span>
                          )}
                        </td>

                        <td className="px-3.5 py-3">
                          {u.brokerConnected ? (
                            <div>
                              <span className="chip text-[10px] text-emerald-400 font-semibold">
                                {u.broker?.toUpperCase() || 'MT5'} Connected
                              </span>
                              {u.brokerAccountId && (
                                <p className="text-[10px] text-ink-soft font-mono mt-0.5">
                                  Acct: {u.brokerAccountId}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-ink-faint text-[11px]">Not connected</span>
                          )}
                        </td>

                        <td className="px-3.5 py-3">
                          {u.botEnabled ? (
                            <span className="chip text-[10px] text-emerald-400">
                              <StatusDot tone="up" /> Live Trading
                            </span>
                          ) : (
                            <span className="chip text-[10px] text-ink-faint">
                              <StatusDot tone="idle" /> Paused
                            </span>
                          )}
                        </td>

                        <td className="px-3.5 py-3 text-ink-soft text-[11px] whitespace-nowrap">
                          {formatDate(u.createdAt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Tab 3: Deposits & Ledger ──────────────────────────────────── */}
      {activeTab === 'deposits' && (
        <Card className="p-5 space-y-4">
          <SectionTitle
            title="Total Deposits & Transactions"
            subtitle="Real-time log of subscription deposits made to TradeBot."
          />

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              <input
                type="text"
                placeholder="Search by reference ID or phone…"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="input pl-9 text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={txStatusFilter}
                onChange={(e) => setTxStatusFilter(e.target.value as any)}
                className="input text-xs h-9 px-2.5 w-36"
              >
                <option value="ALL">All Statuses</option>
                <option value="completed">Completed Only</option>
                <option value="pending">Pending Only</option>
                <option value="failed">Failed Only</option>
              </select>

              <select
                value={txCurrencyFilter}
                onChange={(e) => setTxCurrencyFilter(e.target.value as any)}
                className="input text-xs h-9 px-2.5 w-32"
              >
                <option value="ALL">All Currencies</option>
                <option value="UGX">UGX Only</option>
                <option value="KES">KES Only</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-ink-soft">
            <p>
              Showing <strong className="text-ink">{filteredTransactions.length}</strong> of{' '}
              <strong className="text-ink">{transactions.length}</strong> transaction records.
            </p>

            <div className="flex items-center gap-3">
              <span className="chip text-[10px] text-emerald-400 font-bold">
                UGX {metrics.totalUgx.toLocaleString()}
              </span>
              <span className="chip text-[10px] text-emerald-400 font-bold">
                KES {metrics.totalKes.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-ink-soft text-[10px] uppercase font-bold tracking-wider border-b border-line">
                <tr>
                  <th className="px-3.5 py-2.5">Date & Time</th>
                  <th className="px-3.5 py-2.5">Payer Phone</th>
                  <th className="px-3.5 py-2.5">Plan</th>
                  <th className="px-3.5 py-2.5">Amount</th>
                  <th className="px-3.5 py-2.5">Status</th>
                  <th className="px-3.5 py-2.5">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-ink-soft">
                      No matching deposits or transactions found.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => {
                    const status = tx.status || 'pending';
                    const amount = Number(tx.amount) || 0;
                    const curr = tx.currency || 'UGX';

                    return (
                      <tr key={tx.id} className="hover:bg-surface/50 transition-colors">
                        <td className="px-3.5 py-3 text-ink-soft whitespace-nowrap">
                          {formatDate(tx.createdAt || tx.completedAt)}
                        </td>

                        <td className="px-3.5 py-3 font-bold tnum">
                          {tx.phoneNumber || '—'}
                        </td>

                        <td className="px-3.5 py-3 capitalize">
                          {tx.planId ? `${tx.planId} Bot` : 'Subscription'}
                        </td>

                        <td className="px-3.5 py-3 font-extrabold tnum text-ink">
                          {curr} {amount.toLocaleString()}
                        </td>

                        <td className="px-3.5 py-3">
                          {status === 'completed' ? (
                            <span className="chip text-[10px] font-bold text-emerald-400 border-emerald-500/25">
                              ✓ Completed
                            </span>
                          ) : status === 'pending' ? (
                            <span className="chip text-[10px] font-bold text-amber-400 border-amber-500/25">
                              ⏳ Pending
                            </span>
                          ) : (
                            <span className="chip text-[10px] font-bold text-rose-400 border-rose-500/25">
                              ✗ Failed
                            </span>
                          )}
                        </td>

                        <td className="px-3.5 py-3 text-ink-faint font-mono text-[11px]">
                          {tx.reference || tx.id}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
