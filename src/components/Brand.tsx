import { cx } from './ui';

/** Product name shown to users. Internal ids (tradebot_users, tb* functions) are unchanged. */
export const BRAND_NAME = 'EA Trading Bot';

/** Candlestick logo mark. */
export function BrandMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={cx(
        'inline-flex items-center justify-center shrink-0 rounded-[28%] text-white',
        'bg-gradient-to-br from-[#14c08f] to-[#0a7d5e] shadow-[0_6px_18px_-6px_rgba(14,159,119,0.65)]',
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="none">
        <path d="M6 3v4M6 15v6M12 2v3M12 13v4M18 6v4M18 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="4" y="7" width="4" height="8" rx="1.2" fill="currentColor" />
        <rect x="10" y="5" width="4" height="8" rx="1.2" fill="currentColor" fillOpacity="0.55" />
        <rect x="16" y="10" width="4" height="7" rx="1.2" fill="currentColor" />
      </svg>
    </span>
  );
}

/** Logo mark + wordmark. */
export function BrandLogo({ className, size = 36, light = false }: { className?: string; size?: number; light?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <BrandMark size={size} />
      <span className={cx('font-bold tracking-tight leading-none', light ? 'text-white' : 'text-ink')}>
        <span className={light ? 'text-[#5eead4]' : 'text-accent'}>EA</span> Trading Bot
      </span>
    </span>
  );
}

