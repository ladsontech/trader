import { cx } from './ui';

/** Product name shown to users. Internal ids (tradebot_users, tb* functions) are unchanged. */
export const BRAND_NAME = 'EA Trading Bot';

/** Clean obsidian + gold/emerald candlestick mark inspired by Exness & Binance. */
export function BrandMark({ className, size = 34 }: { className?: string; size?: number }) {
  return (
    <span
      className={cx(
        'inline-flex items-center justify-center shrink-0 rounded-[9px] bg-[#0b0e11] text-white border border-black/10',
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none">
        <path d="M6 4v3M6 15v5M12 3v3M12 13v5M18 5v4M18 16v4" stroke="#ffffff" strokeWidth="1.75" strokeLinecap="round" strokeOpacity="0.85" />
        <rect x="4" y="7" width="4" height="8" rx="1" fill="#0ecb81" />
        <rect x="10" y="6" width="4" height="7" rx="1" fill="#f0b90b" />
        <rect x="16" y="9" width="4" height="7" rx="1" fill="#0ecb81" />
      </svg>
    </span>
  );
}

/** Logo mark + wordmark. */
export function BrandLogo({ className, size = 34, light = false }: { className?: string; size?: number; light?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <BrandMark size={size} />
      <span className={cx('font-bold tracking-tight leading-none', light ? 'text-white' : 'text-ink')}>
        EA Trading Bot
      </span>
    </span>
  );
}
