export interface TradeBotPackage {
  id: string;
  name: string;
  price: number;
  badge: string;
  features: string[];
  recommended?: boolean;
}

export const PACKAGES: TradeBotPackage[] = [
  {
    id: 'standard',
    name: 'Standard Bot',
    price: 50000,
    badge: 'STANDARD',
    features: [
      'Access to the trading bot',
      'Exness & FBS broker support',
      'Up to 3 currency pairs',
      'Basic risk management',
      'Daily trade reports',
    ],
  },
  {
    id: 'premium',
    name: 'Premium Bot',
    price: 100000,
    badge: 'PREMIUM',
    recommended: true,
    features: [
      'Everything in Standard',
      'Unlimited currency pairs',
      'Advanced risk management',
      'Priority trade execution',
      'Real-time notifications',
      'Dedicated support',
    ],
  },
];

export interface BrokerConfig {
  id: string;
  name: string;
  logo: string;
  color: string;
  description: string;
  fields: { key: string; label: string; placeholder: string; type: string }[];
}

export const BROKERS: BrokerConfig[] = [
  {
    id: 'exness',
    name: 'Exness',
    logo: 'E',
    color: '#FBBF24',
    description: 'Trade Forex, metals, crypto and more with tight spreads.',
    fields: [
      { key: 'accountId', label: 'Account ID', placeholder: 'e.g. 12345678', type: 'text' },
      { key: 'apiPassword', label: 'API Password', placeholder: 'Your investor/API password', type: 'password' },
      { key: 'server', label: 'Server', placeholder: 'e.g. Exness-Real9', type: 'text' },
    ],
  },
  {
    id: 'fbs',
    name: 'FBS',
    logo: 'F',
    color: '#22D3EE',
    description: 'Global forex broker with competitive trading conditions.',
    fields: [
      { key: 'accountId', label: 'Account Number', placeholder: 'e.g. 87654321', type: 'text' },
      { key: 'apiPassword', label: 'Trading Password', placeholder: 'Your trading password', type: 'password' },
      { key: 'server', label: 'Server', placeholder: 'e.g. FBS-Real-14', type: 'text' },
    ],
  },
];

export const TRADING_PAIRS = [
  { symbol: 'EURUSD', name: 'EUR/USD', category: 'Major' },
  { symbol: 'GBPUSD', name: 'GBP/USD', category: 'Major' },
  { symbol: 'USDJPY', name: 'USD/JPY', category: 'Major' },
  { symbol: 'AUDUSD', name: 'AUD/USD', category: 'Major' },
  { symbol: 'USDCAD', name: 'USD/CAD', category: 'Major' },
  { symbol: 'XAUUSD', name: 'XAU/USD', category: 'Metal' },
  { symbol: 'GBPJPY', name: 'GBP/JPY', category: 'Cross' },
  { symbol: 'EURJPY', name: 'EUR/JPY', category: 'Cross' },
];

export type TradeDirection = 'BUY' | 'SELL';
export type TradeStatus = 'open' | 'closed' | 'pending';

export interface Trade {
  id: string;
  pair: string;
  direction: TradeDirection;
  lotSize: number;
  entryPrice: number;
  currentPrice?: number;
  exitPrice?: number;
  pnl: number;
  status: TradeStatus;
  openedAt: number;
  closedAt?: number;
}
