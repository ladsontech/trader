import React from 'react';
import { Loader2 } from 'lucide-react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ── Button ───────────────────────────────────────────────────── */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  block?: boolean;
};

export function Button({
  variant = 'primary',
  loading = false,
  block = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const variantClass =
    variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : 'btn-ghost';
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx('btn', variantClass, block && 'w-full', className)}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ── Card ─────────────────────────────────────────────────────── */

export function Card({
  className,
  children,
  quiet = false,
}: {
  className?: string;
  children: React.ReactNode;
  quiet?: boolean;
}) {
  return <div className={cx(quiet ? 'card-quiet' : 'card', className)}>{children}</div>;
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="text-[13px] text-ink-soft mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-xl sm:text-2xl font-semibold text-ink">{title}</h1>
      {subtitle && <p className="text-sm text-ink-soft mt-1 max-w-prose">{subtitle}</p>}
    </header>
  );
}

/* ── Field ────────────────────────────────────────────────────── */

export function Field({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] text-down">{error}</p>
      ) : help ? (
        <p className="mt-1.5 text-[12px] text-ink-faint leading-relaxed">{help}</p>
      ) : null}
    </div>
  );
}

/* ── Feedback ─────────────────────────────────────────────────── */

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warn' | 'error';
  title?: string;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    info: 'border-line bg-surface-2 text-ink-soft',
    success: 'border-accent/25 bg-accent/8 text-accent',
    warn: 'border-warn/25 bg-warn/8 text-warn',
    error: 'border-down/25 bg-down/8 text-down',
  };
  return (
    <div className={cx('rounded-[10px] border px-3.5 py-3 text-[13px]', tones[tone])}>
      {title && <p className="font-semibold mb-0.5">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'up' | 'down';
}) {
  const toneClass =
    tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-ink';
  return (
    <div className="card px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className={cx('tnum text-lg mt-1', toneClass)}>{value}</p>
      {hint && <p className="text-[11px] text-ink-faint mt-0.5">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="card px-6 py-12 text-center">
      {icon && (
        <div className="w-11 h-11 rounded-[12px] bg-surface-2 border border-line flex items-center justify-center mx-auto mb-4 text-ink-soft">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      {children && (
        <p className="text-[13px] text-ink-soft mt-1.5 max-w-sm mx-auto leading-relaxed">
          {children}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-10 text-ink-soft">
      <Loader2 className="w-4 h-4 animate-spin" />
      {label && <span className="text-[13px]">{label}</span>}
    </div>
  );
}

export function StatusDot({ tone }: { tone: 'up' | 'down' | 'warn' | 'idle' }) {
  const color =
    tone === 'up'
      ? 'bg-up'
      : tone === 'down'
        ? 'bg-down'
        : tone === 'warn'
          ? 'bg-warn'
          : 'bg-ink-faint';
  return (
    <span
      className={cx('inline-block w-1.5 h-1.5 rounded-full', color, tone === 'up' && 'pulse-dot')}
    />
  );
}
