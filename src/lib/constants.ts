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
  painPoint: string;
  solution: string;
  manualComparison: string;
  botComparison: string;
  statBadge: string;
  points: string[];
}

export const ONBOARDING: OnboardingSlide[] = [
  {
    key: 'emotions',
    eyebrow: 'The #1 Reason Traders Fail',
    title: 'Eliminate Emotional Mistakes & Revenge Trading',
    body:
      '90% of retail forex traders lose capital due to psychological traps: panic-closing winners, moving stop losses, and revenge trading after a single bad session.',
    painPoint: 'Fear, greed, and revenge trading wipe out accounts in minutes.',
    solution: 'Cold mathematical discipline applied on every single trade without emotion.',
    manualComparison: '❌ Moving stop losses, revenge trade sizing, panic entries',
    botComparison: '✅ Fixed ATR stop loss, automated take profit, 0% emotion',
    statBadge: '0% Emotion · 100% Rule Adherence',
    points: [
      'Strict 0.5% to 1% equity-based lot sizing per trade (never over-leverage)',
      'Automated Stop Loss & Take Profit set on every order before entry',
      'Hard daily loss ceiling halts trading if market conditions turn adverse',
    ],
  },
  {
    key: 'time',
    eyebrow: 'Screen Fatigue & Time',
    title: 'Stop Staring at Charts 14 Hours Every Day',
    body:
      'Staring at candles all day causes burnout. You miss the best London & New York session moves while at your day job, commuting, or asleep at night.',
    painPoint: 'Missing high-probability breakouts while working or sleeping.',
    solution: '24/5 automated cloud engine checking every 15-minute candle for you.',
    manualComparison: '❌ Glued to MT5 screen for hours, entering late out of fatigue',
    botComparison: '✅ 24/5 cloud engine scanning every 15m candle automatically',
    statBadge: '24/5 Cloud Scanning · Hands-Free',
    points: [
      'Checks 15-minute timeframe every quarter hour around the clock',
      'Executes during high-volume London & New York sessions automatically',
      'Runs hands-free so you can work, commute, and sleep in peace',
    ],
  },
  {
    key: 'security',
    eyebrow: 'Capital Security',
    title: 'Your Money NEVER Leaves Your Broker',
    body:
      'Never send trading funds to third-party platforms or fake account managers. TradeBot connects directly to your own licensed Exness or FBS MT5 broker account.',
    painPoint: 'Scams, handing money to strangers, and blocked platform withdrawals.',
    solution: '100% non-custodial API bridge — you keep total control of deposits & withdrawals.',
    manualComparison: '❌ Sending capital to third-party platforms or signal groups',
    botComparison: '✅ Funds stay 100% in your own licensed broker (Exness / FBS)',
    statBadge: '100% Non-Custodial · You Keep Full Control',
    points: [
      'Your funds stay entirely inside your personal MT5 broker account',
      'Watch every single order execute live on your MetaTrader 5 app',
      'Deposit and withdraw your money anytime with zero lockup',
    ],
  },
  {
    key: 'edge',
    eyebrow: 'Quantitative Strategy',
    title: 'A Systematic Edge With Demo Account Safety',
    body:
      'Stop guessing trend directions with 20 conflicting indicators. TradeBot uses algorithmic EMA trend filters and RSI pullbacks, and you can test it on a free MT5 Demo account first.',
    painPoint: 'Indicator overload, inconsistent rules, and risking real capital untested.',
    solution: 'Proven algorithmic momentum strategy + full MT5 Demo account compatibility.',
    manualComparison: '❌ Guessing direction with conflicting indicators & gut feeling',
    botComparison: '✅ Systematic rules: EMA Trend + RSI Pullback + ATR Protection',
    statBadge: 'Demo Compatible · Annual Access',
    points: [
      'Fully compatible with MT5 Demo accounts — test before trading real money',
      'Full 365 days of automated cloud trading execution included',
      'Instant mobile money payment & activation (MTN, Airtel, M-Pesa)',
    ],
  },
];

/* ── Display helpers ──────────────────────────────────────────── */

export const TIMEFRAME_LABEL = '15-minute chart';
export const STRATEGY_LABEL = 'EMA Pullback Trend';
