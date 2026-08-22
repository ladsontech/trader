import { useState } from 'react';
import { useNavigate } from 'react-router';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/auth-context';
import { ONBOARDING, PLANS } from '../lib/constants';
import { ugx } from '../lib/format';
import { Button, cx } from '../components/ui';
import { ArrowLeft, ArrowRight, Bot, Check, ShieldCheck } from 'lucide-react';

/**
 * Shown once, immediately after sign-up, before the app is reachable.
 * Four cards that say what the product actually does — including the part
 * about risk, because a user who understands the downside is a user who
 * stays.
 */
export default function Onboarding() {
  const navigate = useNavigate();
  const { markOnboarded } = useAuth();
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);

  const slide = ONBOARDING[index];
  const isLast = index === ONBOARDING.length - 1;
  const cheapest = Math.min(...PLANS.map((p) => p.price));

  const next = async () => {
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    setFinishing(true);
    await markOnboarded();
    navigate('/subscribe', { replace: true });
  };

  return (
    <div className="min-h-screen grid-backdrop flex flex-col">
      <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8">
        <div className="w-full max-w-lg sm:bg-surface sm:border sm:border-line sm:rounded-[14px] sm:p-8">
          {/* Brand + progress */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-[9px] bg-accent-soft border border-accent/25 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-accent" />
            </div>
            <div className="flex items-center gap-1.5 flex-1">
              {ONBOARDING.map((s, i) => (
                <div
                  key={s.key}
                  className={cx(
                    'h-[3px] flex-1 rounded-full transition-colors duration-300',
                    i <= index ? 'bg-accent' : 'bg-line-strong'
                  )}
                />
              ))}
            </div>
            <span className="tnum text-[11px] text-ink-faint shrink-0">
              {index + 1}/{ONBOARDING.length}
            </span>
          </div>

          <div key={slide.key} className="fade-up">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent mb-3">
              {slide.eyebrow}
            </p>

            <h1 className="text-[25px] sm:text-[28px] font-semibold leading-[1.18] text-ink">
              {slide.title}
            </h1>

            <p className="mt-3.5 text-[14.5px] leading-relaxed text-ink-soft">{slide.body}</p>

            <ul className="mt-6 space-y-2.5">
              {slide.points.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 w-[18px] h-[18px] rounded-full bg-accent-soft text-accent flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" strokeWidth={3} />
                  </span>
                  <span className="text-[14px] text-ink leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>

            {isLast && (
              <div className="mt-6 card-quiet px-4 py-3.5 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <p className="text-[13px] text-ink-soft leading-relaxed">
                  Plans start at{' '}
                  <span className="tnum text-ink font-semibold">{ugx(cheapest)}</span> for 30
                  days. You pay by MTN or Airtel mobile money on the next screen, and the bot
                  only starts once you connect your own broker account.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-8 flex items-center gap-3">
            {index > 0 ? (
              <Button variant="ghost" onClick={() => setIndex((i) => i - 1)}>
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            ) : (
              <button
                onClick={() => signOut(auth)}
                className="text-[13px] text-ink-faint hover:text-ink-soft px-1 cursor-pointer"
              >
                Sign out
              </button>
            )}

            <Button className="ml-auto" onClick={next} loading={finishing}>
              {isLast ? 'Choose a plan' : 'Next'}
              {!isLast && <ArrowRight className="w-4 h-4" />}
            </Button>
          </div>

          <p className="mt-5 text-[11px] text-ink-faint text-center leading-relaxed">
            Trading leveraged forex carries a risk of loss.
          </p>
        </div>
      </div>
    </div>
  );
}
