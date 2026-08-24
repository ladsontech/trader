/**
 * Client-side copies of catalogue data.
 *
 * Prices here are for DISPLAY ONLY — the amount actually charged is read
 * from the server's own PLANS table in functions/src/config.ts, so editing
 * this file cannot change what anybody pays.
 */

export type PlanId = 'standard' | 'premium';

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  price: number; // UGX fallback
  priceUgx: number;
  priceKes: number;
  durationDays: number;
  pairs: string;
  riskPercent: number;
  maxOpenPositions: number;
  features: string[];
  recommended?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'standard',
    name: 'Standard',
    tagline: 'The three majors, traded carefully.',
    price: 50000,
    priceUgx: 50000,
    priceKes: 1800,
    durationDays: 365,
    pairs: 'EUR/USD · GBP/USD · USD/JPY',
    riskPercent: 0.5,
    maxOpenPositions: 3,
    features: [
      '3 major currency pairs',
      '0.5% equity risk per trade',
      'Up to 3 positions at once',
      'Stop loss and take profit on every order',
      'Full trade history from your broker',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Every pair the bot trades, including gold.',
    price: 100000,
    priceUgx: 100000,
    priceKes: 3500,
    durationDays: 365,
    pairs: '7 forex pairs + XAU/USD',
    riskPercent: 1,
    maxOpenPositions: 6,
    recommended: true,
    features: [
      '8 instruments including gold (XAU/USD)',
      '1% equity risk per trade',
      'Up to 6 positions at once',
      'Priority execution slot each cycle',
      'Everything in Standard',
    ],
  },
];

export function getPlanPrice(plan: Plan, currency: 'UGX' | 'KES' = 'UGX'): number {
  return currency === 'KES' ? plan.priceKes : plan.priceUgx;
}

export function planById(id?: string | null): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/* ── Brokers ──────────────────────────────────────────────────── */

export interface BrokerField {
  key: 'accountId' | 'password' | 'server';
  label: string;
  placeholder: string;
  type: 'text' | 'password';
  help?: string;
}

export interface Broker {
  id: 'exness' | 'fbs';
  name: string;
  mark: string;
  tint: string;
  blurb: string;
  serverExample: string;
  fields: BrokerField[];
}

const commonFields = (serverExample: string, accountLabel: string): BrokerField[] => [
  {
    key: 'accountId',
    label: accountLabel,
    placeholder: '12345678',
    type: 'text',
    help: 'The number shown at the top of your MetaTrader 5 terminal.',
  },
  {
    key: 'password',
    label: 'MT5 password',
    placeholder: '••••••••',
    type: 'password',
    help: 'Use your main trading password. An investor (read-only) password cannot place orders.',
  },
  {
    key: 'server',
    label: 'Server',
    placeholder: serverExample,
    type: 'text',
    help: 'Copy it exactly as MetaTrader shows it — spelling and numbers must match.',
  },
];

export const BROKERS: Broker[] = [
  {
    id: 'exness',
    name: 'Exness',
    mark: 'E',
    tint: '#f5c451',
    blurb: 'MT5 real and demo accounts.',
    serverExample: 'Exness-Real9',
    fields: commonFields('Exness-Real9', 'Account number'),
  },
  {
    id: 'fbs',
    name: 'FBS',
    mark: 'F',
    tint: '#5aa9f5',
    blurb: 'MT5 real and demo accounts.',
    serverExample: 'FBS-Real-14',
    fields: commonFields('FBS-Real-14', 'Account number'),
  },
];

/* ── Onboarding ───────────────────────────────────────────────── */

export interface OnboardingSlide {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
}

export const ONBOARDING: OnboardingSlide[] = [
  {
    key: 'what',
    eyebrow: 'What this is',
    title: 'A trading bot that runs on your own broker account',
    body:
      'Your money never leaves your broker. TradeBot connects to your Exness or FBS MT5 account and places orders there — you keep full control, and you can withdraw any time.',
    points: [
      'Your funds stay with your broker',
      'Every order is visible in your own MT5 terminal',
      'Disconnect in one tap, whenever you want',
    ],
  },
  {
    key: 'how',
    eyebrow: 'How it trades',
    title: 'One rule set, applied without emotion',
    body:
      'The bot checks the 15-minute chart every quarter hour. It only enters when the trend and the pullback agree, and every single order carries a stop loss and a take profit before it is sent.',
    points: [
      'EMA trend filter + RSI pullback trigger',
      'ATR-sized stop loss on every position',
      'Most cycles it does nothing — that is the point',
    ],
  },
  {
    key: 'risk',
    eyebrow: 'Risk first',
    title: 'Limits it cannot talk itself out of',
    body:
      'Position size is calculated from your account equity, not guessed. If the day goes badly the bot stops itself before the damage compounds.',
    points: [
      '0.5–1% of equity risked per trade',
      'Daily loss limit halts trading for the day',
      'Hard cap on lot size and open positions',
    ],
  },
  {
    key: 'honest',
    eyebrow: 'Before you pay',
    title: 'Trading can lose money',
    body:
      'This is an automated strategy, not a guarantee. Leveraged forex carries real risk and past results never promise future ones. Start on a demo account if you want to watch it work first.',
    points: [
      'Works with MT5 demo accounts too',
      'Cancel by simply not renewing',
      'You can pause the bot at any moment',
    ],
  },
];

/* ── Display helpers ──────────────────────────────────────────── */

export const TIMEFRAME_LABEL = '15-minute chart';
export const STRATEGY_LABEL = 'EMA Pullback Trend';
