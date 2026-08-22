export function ugx(amount: number): string {
  return `UGX ${Math.round(amount).toLocaleString('en-UG')}`;
}

export function money(amount: number, currency = 'USD'): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const symbol = currency === 'USD' ? '$' : '';
  const body = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${sign}${symbol}${body}` : `${sign}${body} ${currency}`;
}

export function signedMoney(amount: number, currency = 'USD'): string {
  const prefix = amount > 0 ? '+' : '';
  return prefix + money(amount, currency);
}

export function price(value: number | null | undefined, digits = 5): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const d = Math.abs(value) > 100 ? 2 : digits;
  return value.toFixed(d);
}

export function percent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function pairLabel(symbol: string | null | undefined): string {
  if (!symbol) return '—';
  if (symbol.length === 6) return `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
  return symbol;
}

export function timeAgo(ms: number | null | undefined): string {
  if (!ms) return '—';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function dateTime(ms: number | null | undefined): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function daysLeft(expiresAt?: number | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
}

/**
 * "347 days left" is technically right for an annual plan and reads like
 * noise. Collapse anything past a month or two into months.
 */
export function remainingLabel(expiresAt?: number | null): string {
  const days = daysLeft(expiresAt);
  if (days <= 0) return 'Expired';
  if (days === 1) return '1 day left';
  if (days < 45) return `${days} days left`;
  const months = Math.round(days / 30.44);
  return `${months} month${months === 1 ? '' : 's'} left`;
}

export function renewalDate(expiresAt?: number | null): string {
  if (!expiresAt) return '—';
  return new Date(expiresAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
