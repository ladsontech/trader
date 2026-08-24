import { useState } from 'react';
import { Link } from 'react-router';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';
import { apiErrorMessage, setBotEnabled } from '../lib/api';
import { planById, STRATEGY_LABEL, TIMEFRAME_LABEL } from '../lib/constants';
import { remainingLabel, renewalDate } from '../lib/format';
import { Button, Card, Notice, PageTitle, SectionTitle, cx } from '../components/ui';
import { ArrowRight, LogOut, Pause, Play } from 'lucide-react';

export default function Settings() {
  const { user, userData, isSubscribed, isBrokerConnected, country, setCountry, refreshUserData } = useAuth();
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  const plan = planById(userData?.subscriptionPlan);

  const toggleBot = async () => {
    setToggling(true);
    setError('');
    try {
      await setBotEnabled(!userData?.botEnabled);
      await refreshUserData();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not change the bot setting.'));
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageTitle title="Settings" />

      {error && (
        <div className="mb-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {/* Account */}
      <Card className="p-5">
        <SectionTitle title="Account" />
        <Row label="Phone number" value={userData?.phoneDigits || user?.email?.split('@')[0] || '—'} />
        <Row
          label="Subscription"
          value={
            isSubscribed
              ? `${plan?.name ?? 'Active'} · ${remainingLabel(userData?.subscriptionExpiresAt)}`
              : userData?.subscriptionStatus === 'expired'
                ? 'Expired'
                : 'None'
          }
        />
        {userData?.subscriptionExpiresAt ? (
          <Row label="Renews before" value={renewalDate(userData.subscriptionExpiresAt)} />
        ) : null}

        <div className="divider my-4" />
        <Link to="/subscribe" className="btn btn-ghost w-full">
          {isSubscribed ? 'Renew or change plan' : 'Choose a plan'}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </Card>

      {/* Regional Currency */}
      <Card className="p-5 mt-4">
        <SectionTitle
          title="Regional Currency"
          subtitle="Select your preferred currency and payment channel for plan subscriptions."
        />
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <button
            type="button"
            onClick={() => setCountry('UG')}
            className={cx(
              'flex items-center gap-3 p-3 rounded-xl border text-left transition cursor-pointer',
              country === 'UG'
                ? 'border-accent bg-accent-soft text-ink-base shadow-xs'
                : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink-base'
            )}
          >
            <span className="text-xl">🇺🇬</span>
            <div>
              <p className="text-xs font-semibold text-ink-base">Uganda (UGX)</p>
              <p className="text-[11px] text-ink-faint">MTN & Airtel Money</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setCountry('KE')}
            className={cx(
              'flex items-center gap-3 p-3 rounded-xl border text-left transition cursor-pointer',
              country === 'KE'
                ? 'border-accent bg-accent-soft text-ink-base shadow-xs'
                : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink-base'
            )}
          >
            <span className="text-xl">🇰🇪</span>
            <div>
              <p className="text-xs font-semibold text-ink-base">Kenya (KES)</p>
              <p className="text-[11px] text-ink-faint">Safaricom M-Pesa</p>
            </div>
          </button>
        </div>
      </Card>

      {/* Bot */}
      <Card className="p-5 mt-4">
        <SectionTitle
          title="Trading bot"
          subtitle={`${STRATEGY_LABEL} · ${TIMEFRAME_LABEL}`}
        />

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[13.5px]">
              {userData?.botEnabled ? 'Running' : 'Paused'}
            </p>
            <p className="text-[12px] text-ink-faint mt-0.5 leading-relaxed">
              Pausing stops new orders. Positions already open stay open and keep their stop
              loss and take profit.
            </p>
          </div>
          <Button
            variant="ghost"
            loading={toggling}
            onClick={toggleBot}
            disabled={!isBrokerConnected}
            className="shrink-0"
          >
            {userData?.botEnabled ? (
              <>
                <Pause className="w-4 h-4" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Resume
              </>
            )}
          </Button>
        </div>

        {!isBrokerConnected && (
          <div className="mt-4">
            <Notice tone="info">
              Connect a broker account before the bot can run.{' '}
              <Link to="/broker" className="font-semibold underline">
                Connect now
              </Link>
            </Notice>
          </div>
        )}
      </Card>

      {/* Broker */}
      <Card className="p-5 mt-4">
        <SectionTitle title="Broker" />
        <Row label="Broker" value={userData?.broker || 'Not connected'} />
        <Row label="Account" value={userData?.brokerAccountId || '—'} />
        <Row label="Server" value={userData?.brokerServer || '—'} />

        <div className="divider my-4" />
        <Link to="/broker" className="btn btn-ghost w-full">
          {isBrokerConnected ? 'Manage connection' : 'Connect a broker'}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </Card>

      {/* Risk disclosure */}
      <Card className="p-5 mt-4" quiet>
        <SectionTitle title="Risk disclosure" />
        <p className="text-[12.5px] text-ink-soft leading-relaxed">
          TradeBot places orders on a broker account that belongs to you. Trading leveraged
          forex can lose money, including more than you intended on a fast market. Past
          performance never guarantees future results. Only trade with money you can afford
          to lose, and consider testing on a demo account first.
        </p>
      </Card>

      <div className="mt-4">
        <Button
          variant="ghost"
          block
          onClick={() => signOut(auth)}
          className={cx('text-ink-soft')}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-[13.5px]">
      <span className="text-ink-soft">{label}</span>
      <span className="tnum text-ink text-right">{value}</span>
    </div>
  );
}
