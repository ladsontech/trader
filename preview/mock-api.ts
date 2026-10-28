import { updateMockState } from './mock-auth';
export function apiErrorMessage(e: unknown, f: string) { return (e as Error)?.message || f; }
const flow = new URLSearchParams(location.search).get('screen') === 'flow';
let paid = false;
export const initiateSubscription = async (planId = 'premium') => {
  (window as any).__calls = [...((window as any).__calls || []), ['initiateSubscription', planId]];
  return { success: true, reused: false, reference: 'r', planId, amount: 100000 };
};
export const checkPayment = async () => {
  if (!flow) return { status: 'pending' as const, failureReason: null };
  // Second poll: Marz Pay confirmed → the server activates the plan.
  if (paid) {
    updateMockState({ isSubscribed: true, userData: { subscriptionStatus: 'active', subscriptionPlan: 'premium' } });
    return { status: 'completed' as const, failureReason: null };
  }
  paid = true;
  return { status: 'pending' as const, failureReason: null };
};
export const cancelPayment = async () => {
  paid = false;
  return { success: true };
};
export const connectBroker = async (input: { password: string }) => {
  if (input.password === 'wrong') throw new Error('The broker rejected these credentials. Check the account number, password and server name.');
  updateMockState({ isBrokerConnected: true, userData: { brokerConnected: true, broker: 'Exness', botEnabled: true } });
  return { success: true, broker: 'Exness', currency: 'USD', balance: 1840.55, equity: 1840.55, leverage: 500, server: 'Exness-MT5Trial9', accountMasked: '128••04' };
};
export const disconnectBroker = async () => ({ success: true });
export const setBotEnabled = async () => ({ success: true, botEnabled: true });
export const closePosition = async () => ({ success: true, message: 'ok' });
export const brokerState = async () => ({
  connected: true, broker: 'Exness', server: 'Exness-Real9', accountMasked: '128••04',
  currency: 'USD', balance: 1840.55, equity: 1893.20, margin: 112.4, freeMargin: 1780.8,
  marginLevel: 1684.3, leverage: 500, tradeAllowed: true, openPositions: 3, floatingPnl: 52.65,
});
export const getTrades = async () => ({
  open: [
    { id: '1', symbol: 'EURUSD', direction: 'BUY' as const, volume: 0.05, openPrice: 1.08423, currentPrice: 1.08691, stopLoss: 1.08102, takeProfit: 1.08905, profit: 13.40, swap: -0.12, commission: -0.5, openedAt: Date.now() - 5400000, comment: 'TradeBot', status: 'open' as const },
    { id: '2', symbol: 'XAUUSD', direction: 'BUY' as const, volume: 0.02, openPrice: 2898.50, currentPrice: 2914.82, stopLoss: 2881.20, takeProfit: 2924.60, profit: 32.64, swap: 0, commission: -0.4, openedAt: Date.now() - 12600000, comment: 'TradeBot', status: 'open' as const },
    { id: '3', symbol: 'GBPJPY', direction: 'SELL' as const, volume: 0.03, openPrice: 196.482, currentPrice: 196.263, stopLoss: 197.010, takeProfit: 195.690, profit: 6.61, swap: -0.3, commission: -0.3, openedAt: Date.now() - 2400000, comment: 'TradeBot', status: 'open' as const },
  ],
  closed: [
    { id: 'd1', symbol: 'USDJPY', type: 'DEAL_TYPE_SELL', entryType: 'DEAL_ENTRY_OUT', volume: 0.03, price: 154.204, profit: 18.02, commission: -0.3, swap: -0.11, positionId: 'p1', closedAt: Date.now() - 43200000, comment: 'TradeBot', status: 'closed' as const },
    { id: 'd2', symbol: 'AUDUSD', type: 'DEAL_TYPE_SELL', entryType: 'DEAL_ENTRY_OUT', volume: 0.04, price: 0.65651, profit: -9.40, commission: -0.4, swap: 0, positionId: 'p2', closedAt: Date.now() - 176400000, comment: 'TradeBot', status: 'closed' as const },
    { id: 'd3', symbol: 'EURUSD', type: 'DEAL_TYPE_SELL', entryType: 'DEAL_ENTRY_OUT', volume: 0.05, price: 1.09012, profit: 24.85, commission: -0.5, swap: -0.2, positionId: 'p3', closedAt: Date.now() - 262800000, comment: 'TradeBot', status: 'closed' as const },
  ],
  stats: { openCount: 3, closedCount: 26, floatingPnl: 52.65, realizedPnl: 218.43, winRate: 61.5, wins: 16, losses: 10 },
});
export const adminData = async () => ({ users: [], transactions: [] });
