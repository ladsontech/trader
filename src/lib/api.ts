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
  const code = (err?.code || '').replace(/^functions\//, '');
  const message = (err?.message || '').replace(/^Firebase:\s*/i, '').trim();

  // A callable that has not been deployed fails CORS in the browser before it
  // ever reaches Google, and the Firebase SDK surfaces that as a bare
  // `internal` or `not-found` with the code echoed as the message. That is an
  // infrastructure problem, not something the user did wrong — so log the real
  // cause for whoever is on call and show them something actionable.
  const isUnreachable =
    code === 'not-found' ||
    code === 'unavailable' ||
    (code === 'internal' && (!message || /^internal$/i.test(message)));

  if (isUnreachable) {
    console.error(
      '[TradeBot] A Cloud Function could not be reached. If this is a new ' +
        'environment, the tradebot codebase has probably not been deployed:\n' +
        '  cd functions && npm install && cd ..\n' +
        '  firebase deploy --only functions:tradebot',
      error
    );
    return 'We could not reach the payment service. Please try again in a moment — if it keeps failing, contact support.';
  }

  if (message && !/^[a-z-]+$/.test(message)) return message;
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

export function initiateSubscription(
  planId: string,
  phoneNumber: string,
  country: 'UG' | 'KE' = 'UG',
  forceNew?: boolean
) {
  return call<{ planId: string; phoneNumber: string; country?: 'UG' | 'KE'; forceNew?: boolean }, InitiateSubscriptionResult>(
    'tbInitiateSubscription',
    { planId, phoneNumber, country, forceNew }
  );
}

export interface PaymentStatusResult {
  status: 'pending' | 'completed' | 'failed';
  failureReason: string | null;
}

export function checkPayment(reference: string) {
  return call<{ reference: string }, PaymentStatusResult>('tbCheckPayment', { reference });
}

export function cancelPayment(reference?: string | null) {
  return call<{ reference?: string }, { success: boolean }>('tbCancelPayment', {
    reference: reference || undefined,
  });
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
