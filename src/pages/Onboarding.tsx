import { useState } from 'react';
import { useNavigate } from 'react-router';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';
import { ONBOARDING, PLANS, getPlanPrice } from '../lib/constants';
import { formatLocalMoney } from '../lib/format';
import { Button, cx } from '../components/ui';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Lock,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';

/**
 * Shown once, immediately after sign-up, before the paywall.
 * Explains the real psychological and financial pain manual traders face,
 * and how the algorithmic bot solves them before asking for payment.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const { markOnboarded, currency } = useAuth();
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const slide = ONBOARDING[index];
  const isLast = index === ONBOARDING.length - 1;
  const standardPlan = PLANS[0];
  const startingPrice = getPlanPrice(standardPlan, currency);

  const next = async () => {
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    setFinishing(true);
    await markOnboarded();
    navigate('/subscribe', { replace: true });
  };

  const getSlideIcon = (key: string) => {
    switch (key) {
      case 'emotions':
        return <TrendingDown className="w-4 h-4 text-rose-400" />;
      case 'time':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'security':
        return <Lock className="w-4 h-4 text-accent" />;
      case 'edge':
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bot className="w-4 h-4 text-accent" />;
    }
  };

  return (
    <div className="min-h-screen grid-backdrop flex flex-col justify-between">
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6 sm:py-10">
        <div className="w-full max-w-xl sm:bg-surface/90 sm:backdrop-blur-xl sm:border sm:border-line sm:rounded-[18px] sm:p-8 sm:shadow-2xl sm:shadow-black/40">
          
          {/* Header Bar + Progress */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-accent-soft border border-accent/30 flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="w-5 h-5 text-accent" />
            </div>
            
            <div className="flex items-center gap-1.5 flex-1">
              {ONBOARDING.map((s, i) => (
                <button
                  key={s.key}
                  onClick={() => i <= index && setIndex(i)}
                  disabled={i > index}
                  className={cx(
                    'h-1.5 flex-1 rounded-full transition-all duration-300',
                    i === index
                      ? 'bg-accent shadow-sm shadow-accent/40'
                      : i < index
                        ? 'bg-accent/60'
                        : 'bg-line-strong'
                  )}
                  title={`Step ${i + 1}`}
                />
              ))}
            </div>

            <span className="tnum text-xs font-semibold text-ink-faint shrink-0 bg-surface-2 border border-line px-2 py-0.5 rounded-md">
              {index + 1} of {ONBOARDING.length}
            </span>
          </div>

          {/* Slide Content */}
          <div key={slide.key} className="fade-up space-y-5">
            {/* Top Eyebrow + Pill */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-md bg-surface-2 border border-line">
                  {getSlideIcon(slide.key)}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
                  {slide.eyebrow}
                </span>
              </div>

              <span className="chip text-[10.5px] font-semibold text-emerald-400 border-emerald-500/25 bg-emerald-500/5">
                <Sparkles className="w-3 h-3 mr-1 text-emerald-400" />
                {slide.statBadge}
              </span>
            </div>

            {/* Main Headline */}
            <div>
              <h1 className="text-[22px] sm:text-[26px] font-bold leading-[1.2] text-ink tracking-tight">
                {slide.title}
              </h1>
              <p className="mt-2 text-[13.5px] sm:text-[14.5px] leading-relaxed text-ink-soft">
                {slide.body}
              </p>
            </div>

            {/* Pain Point vs TradeBot Solution Card */}
            <div className="rounded-xl border border-line bg-surface-2/60 p-4 space-y-3">
              {/* The Real Pain */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-rose-500/5 border border-rose-500/15">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-rose-300 uppercase tracking-wider text-[10px]">
                    The Manual Trader's Pain
                  </p>
                  <p className="text-ink-soft leading-relaxed">
                    {slide.painPoint}
                  </p>
                </div>
              </div>

              {/* The TradeBot Solution */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold text-emerald-300 uppercase tracking-wider text-[10px]">
                    How TradeBot Solves It
                  </p>
                  <p className="text-ink-soft leading-relaxed">
                    {slide.solution}
                  </p>
                </div>
              </div>
            </div>

            {/* Comparison Quick Strips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="px-3 py-2 rounded-lg bg-surface border border-rose-500/20 text-rose-300/90 font-medium">
                {slide.manualComparison}
              </div>
              <div className="px-3 py-2 rounded-lg bg-surface border border-emerald-500/20 text-emerald-300/90 font-medium">
                {slide.botComparison}
              </div>
            </div>

            {/* Feature Checklist */}
            <div className="pt-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2.5">
                Engineered Safeguards
              </p>
              <ul className="space-y-2">
                {slide.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <span className="mt-0.5 w-[17px] h-[17px] rounded-full bg-accent-soft text-accent flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5" strokeWidth={3.5} />
                    </span>
                    <span className="text-[13px] text-ink leading-relaxed font-medium">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Final Slide Transparency & Reassurance */}
            {isLast && (
              <div className="card-quiet p-4 rounded-xl border border-accent/30 bg-accent-soft/40 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-ink text-[13px]">
                    100% Risk-Free Demo Testing Included
                  </p>
                  <p className="text-ink-soft leading-relaxed">
                    Plans start at only{' '}
                    <strong className="text-accent font-bold">
                      {formatLocalMoney(startingPrice, currency)}
                    </strong>{' '}
                    for a full 365 days of 24/5 cloud trading. You can connect an{' '}
                    <strong className="text-ink">MT5 Demo Account</strong> first to watch every
                    trade without risking a single dollar of real capital.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-7 pt-5 border-t border-line flex items-center justify-between gap-3">
            {index > 0 ? (
              <Button
                variant="ghost"
                onClick={() => setIndex((i) => i - 1)}
                className="text-xs h-10 px-3.5"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            ) : (
              <button
                onClick={() => signOut(auth)}
                className="text-xs text-ink-faint hover:text-ink-soft px-2 py-1.5 cursor-pointer transition"
              >
                Sign out
              </button>
            )}

            <Button
              className="ml-auto h-10 px-5 text-xs font-bold"
              onClick={next}
              loading={finishing}
            >
              {isLast ? 'View Bot Plans & Pricing' : 'Next Advantage'}
              {!isLast && <ArrowRight className="w-4 h-4 ml-1.5" />}
            </Button>
          </div>

          {/* Micro Footer Disclaimer */}
          <p className="mt-4 text-[11px] text-ink-faint text-center leading-relaxed">
            Automated execution on your broker MT5 terminal · Instant Mobile Money activation
          </p>
        </div>
      </div>
    </div>
  );
}
