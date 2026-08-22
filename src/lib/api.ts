/**
 * Typed wrappers around the TradeBot Cloud Functions.
 *
 * Everything that touches money or the broker lives behind these calls —
 * the browser never holds a MetaApi token, a Marz Pay key, or the ability
 * to mark its own subscription active.
 */
import { getFunctions, httpsCallable, type HttpsCallableResult } from 'firebase/functions';
import { app } from './firebase';

const functions = getFunctions(app);

async function call<TReq extends object, TRes>(name: string, payload?: TReq): Promise<TRes> {
  const fn = httpsCallable<TReq, TRes>(functions, name);
  const result = (await fn(payload ?? ({} as TReq))) as HttpsCallableResult<TRes>;
  return result.data;
}

/** Turns a Firebase callable error into something worth showing a user. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const err = error as { code?: string; message?: string };
  if (err?.message && !/^internal$/i.test(err.message)) {
    return err.message.replace(/^Firebase:\s*/i, '');
  }
  return fallback;
}

/* ── Payments ─────────────────────────────────────────────────── */

export interface InitiateSubscriptionResult {
  success: boolean;
  reused: boolean;
  reference: string;
  planId: string;
  amount: number;
  message?: string;
}

export function initiateSubscription(planId: string, phoneNumber: string) {
  return call<{ planId: string; phoneNumber: string }, InitiateSubscriptionResult>(
    'tbInitiateSubscription',
    { planId, phoneNumber }
  );
}

export interface PaymentStatusResult {
  status: 'pending' | 'completed' | 'failed';
  failureReason: string | null;
}

export function checkPayment(reference: string) {
  return call<{ reference: string }, PaymentStatusResult>('tbCheckPayment', { reference });
}

/* ── Broker ───────────────────────────────────────────────────── */

export interface ConnectBrokerResult {
  success: boolean;
  broker: string;
  currency: string;
  balance: number;
  equity: number;
  leverage: number;
  server: string;
  accountMasked: string;
}

export function connectBroker(input: {
  brokerId: string;
  accountId: string;
  password: string;
  server: string;
}) {
  return call<typeof input, ConnectBrokerResult>('tbConnectBroker', input);
}

export function disconnectBroker() {
  return call<Record<string, never>, { success: boolean }>('tbDisconnectBroker');
}

export interface BrokerState {
  connected: boolean;
  broker?: string;
  server?: string;
  accountMasked?: string;
  currency?: string;
  balance?: number;
  equity?: number;
  margin?: number;
  freeMargin?: number;
  marginLevel?: number | null;
  leverage?: number;
  tradeAllowed?: boolean;
  openPositions?: number;
  floatingPnl?: number;
  error?: string;
}

export function brokerState() {
  return call<Record<string, never>, BrokerState>('tbBrokerState');
}

/* ── Trades ───────────────────────────────────────────────────── */

export interface OpenTrade {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  profit: number;
  swap: number;
  commission: number;
  openedAt: number | null;
  comment: string | null;
  status: 'open';
}

export interface ClosedTrade {
  id: string;
  symbol: string | null;
  type: string;
  entryType: string | null;
  volume: number;
  price: number;
  profit: number;
  commission: number;
  swap: number;
  positionId: string | null;
  closedAt: number | null;
  comment: string | null;
  status: 'closed';
}

export interface TradesResult {
  open: OpenTrade[];
  closed: ClosedTrade[];
  stats: {
    openCount: number;
    closedCount: number;
    floatingPnl: number;
    realizedPnl: number;
    winRate: number;
    wins: number;
    losses: number;
  };
}

export function getTrades(days = 30) {
  return call<{ days: number }, TradesResult>('tbGetTrades', { days });
}

export function closePosition(positionId: string) {
  return call<{ positionId: string }, { success: boolean; message: string }>(
    'tbClosePosition',
    { positionId }
  );
}

export function setBotEnabled(enabled: boolean) {
  return call<{ enabled: boolean }, { success: boolean; botEnabled: boolean }>(
    'tbSetBotEnabled',
    { enabled }
  );
}
