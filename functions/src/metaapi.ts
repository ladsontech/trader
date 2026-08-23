/**
 * MetaApi (metaapi.cloud) REST client.
 *
 * MetaApi is a cloud bridge to MetaTrader 4/5. Exness and FBS publish no
 * trading API of their own — they are MT4/MT5 brokers — so this is what
 * makes real order execution on a real Exness/FBS account possible from
 * a serverless backend.
 *
 * Docs:
 *   https://metaapi.cloud/docs/provisioning/
 *   https://metaapi.cloud/docs/client/restApi/
 *
 * The auth token is a Secret Manager secret and is only ever used here,
 * server-side. It is never shipped to the browser.
 */
import { sleep, logError } from "./util";

const PROVISIONING_HOST =
  "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

const DEFAULT_REGION = "new-york";

function clientHost(region: string): string {
  return `https://mt-client-api-v1.${region}.agiliumtrade.ai`;
}

function marketDataHost(region: string): string {
  return `https://mt-market-data-client-api-v1.${region}.agiliumtrade.ai`;
}

export class MetaApiError extends Error {
  readonly status: number;
  readonly details: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "MetaApiError";
    this.status = status;
    this.details = details;
  }
}

export type AccountState =
  | "CREATED"
  | "DEPLOYING"
  | "DEPLOYED"
  | "DEPLOY_FAILED"
  | "UNDEPLOYING"
  | "UNDEPLOYED"
  | "UNDEPLOY_FAILED"
  | "DELETING"
  | "DELETE_FAILED"
  | "REDEPLOY_FAILED"
  | "DRAFT";

export type ConnectionStatus = "CONNECTED" | "DISCONNECTED" | "DISCONNECTED_FROM_BROKER";

export interface TradingAccount {
  _id: string;
  name?: string;
  login?: string;
  server?: string;
  platform?: "mt4" | "mt5";
  region?: string;
  state: AccountState;
  connectionStatus: ConnectionStatus;
  type?: string;
  magic?: number;
}

export interface AccountInformation {
  broker: string;
  currency: string;
  server: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: number;
  marginLevel?: number;
  tradeAllowed?: boolean;
  name?: string;
  login?: number;
  credit?: number;
  type?: string;
}

export interface Position {
  id: string;
  type: "POSITION_TYPE_BUY" | "POSITION_TYPE_SELL";
  symbol: string;
  magic?: number;
  time: string;
  openPrice: number;
  currentPrice?: number;
  currentTickValue?: number;
  stopLoss?: number;
  takeProfit?: number;
  volume: number;
  swap?: number;
  profit: number;
  commission?: number;
  unrealizedProfit?: number;
  comment?: string;
}

export interface Deal {
  id: string;
  type: string;
  entryType?: string;
  symbol?: string;
  magic?: number;
  time: string;
  volume?: number;
  price?: number;
  commission?: number;
  swap?: number;
  profit: number;
  positionId?: string;
  orderId?: string;
  comment?: string;
}

export interface Candle {
  symbol: string;
  timeframe: string;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number;
  spread: number;
  volume: number;
}

export interface SymbolPrice {
  symbol: string;
  bid: number;
  ask: number;
  profitTickValue?: number;
  lossTickValue?: number;
  time?: string;
}

export interface SymbolSpecification {
  symbol: string;
  tickSize: number;
  minVolume: number;
  maxVolume: number;
  volumeStep: number;
  digits: number;
  contractSize?: number;
  stopsLevel?: number;
}

export interface TradeResponse {
  numericCode: number;
  stringCode: string;
  message: string;
  orderId?: string;
  positionId?: string;
}

export class MetaApiClient {
  private readonly token: string;

  constructor(token: string) {
    if (!token || !token.trim()) {
      throw new Error("METAAPI_TOKEN is not configured.");
    }
    this.token = token.trim();
  }

  private async request<T>(
    url: string,
    init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "auth-token": this.token,
      Accept: "application/json",
      ...(init.headers || {}),
    };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(url, {
      method: init.method || "GET",
      headers,
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      const message =
        (parsed as { message?: string })?.message ||
        `MetaApi request failed (${response.status})`;

      /*
        Log the full response body here rather than at the call site. MetaApi
        puts the useful part of a 400 in `details` / `error` — which server
        name it could not resolve, which field it rejected — and without this
        every provisioning failure looks identical in Cloud Logging.
        `logError` redacts before writing, so the password never lands here.
      */
      logError("MetaApi request failed", undefined, {
        status: response.status,
        url: url.replace(/\/accounts\/[^/]+/, "/accounts/<id>"),
        method: init.method || "GET",
        metaApiMessage: message,
        metaApiBody: parsed,
      });

      throw new MetaApiError(message, response.status, parsed);
    }

    return parsed as T;
  }

  /* ── Provisioning ──────────────────────────────────────────── */

  /**
   * Create a MetaTrader account on MetaApi. `keywords` lets MetaApi
   * auto-detect the broker's server settings from the broker name, which
   * is what lets us take just (login, password, server) from the user.
   */
  async createAccount(params: {
    name: string;
    login: string;
    password: string;
    server: string;
    platform: "mt4" | "mt5";
    keywords: string[];
    magic: number;
    region?: string;
  }): Promise<{ id: string; state: AccountState }> {
    const transactionId = randomTransactionId();
    const result = await this.request<{ id: string; state: AccountState }>(
      `${PROVISIONING_HOST}/users/current/accounts`,
      {
        method: "POST",
        headers: { "transaction-id": transactionId },
        body: {
          name: params.name,
          type: "cloud-g2",
          login: params.login,
          password: params.password,
          server: params.server,
          platform: params.platform,
          magic: params.magic,
          keywords: params.keywords,
          region: params.region || DEFAULT_REGION,
        },
      }
    );
    return result;
  }

  async getAccount(accountId: string): Promise<TradingAccount> {
    return this.request<TradingAccount>(
      `${PROVISIONING_HOST}/users/current/accounts/${accountId}`
    );
  }

  async deployAccount(accountId: string): Promise<void> {
    await this.request(
      `${PROVISIONING_HOST}/users/current/accounts/${accountId}/deploy`,
      { method: "POST" }
    );
  }

  async undeployAccount(accountId: string): Promise<void> {
    await this.request(
      `${PROVISIONING_HOST}/users/current/accounts/${accountId}/undeploy`,
      { method: "POST" }
    );
  }

  async deleteAccount(accountId: string): Promise<void> {
    await this.request(`${PROVISIONING_HOST}/users/current/accounts/${accountId}`, {
      method: "DELETE",
    });
  }

  /**
   * Poll until the terminal is DEPLOYED *and* CONNECTED to the broker.
   * A wrong password or wrong server name surfaces here as a timeout with
   * DISCONNECTED_FROM_BROKER — which is exactly the verification we want
   * before telling a user their broker is connected.
   */
  async waitConnected(
    accountId: string,
    timeoutMs = 90_000,
    intervalMs = 3_000
  ): Promise<TradingAccount> {
    const deadline = Date.now() + timeoutMs;
    let last: TradingAccount | null = null;

    while (Date.now() < deadline) {
      try {
        last = await this.getAccount(accountId);
        if (last.state === "DEPLOYED" && last.connectionStatus === "CONNECTED") {
          return last;
        }
        if (last.state === "DEPLOY_FAILED" || last.state === "REDEPLOY_FAILED") {
          throw new MetaApiError(
            "The broker terminal failed to start. Check the server name and try again.",
            400,
            last
          );
        }
      } catch (error) {
        if (error instanceof MetaApiError && error.status !== 404) throw error;
      }
      await sleep(intervalMs);
    }

    throw new MetaApiError(
      last?.connectionStatus === "DISCONNECTED_FROM_BROKER"
        ? "The broker rejected these credentials. Check the account number, password and server name."
        : "Timed out waiting for the broker terminal to connect. Please try again.",
      408,
      last
    );
  }

  /* ── Trading terminal state ────────────────────────────────── */

  async getAccountInformation(
    accountId: string,
    region = DEFAULT_REGION
  ): Promise<AccountInformation> {
    return this.request<AccountInformation>(
      `${clientHost(region)}/users/current/accounts/${accountId}/account-information`
    );
  }

  async getPositions(accountId: string, region = DEFAULT_REGION): Promise<Position[]> {
    return this.request<Position[]>(
      `${clientHost(region)}/users/current/accounts/${accountId}/positions`
    );
  }

  async getDealsByTimeRange(
    accountId: string,
    startTime: Date,
    endTime: Date,
    region = DEFAULT_REGION,
    limit = 500
  ): Promise<Deal[]> {
    const start = encodeURIComponent(startTime.toISOString());
    const end = encodeURIComponent(endTime.toISOString());
    return this.request<Deal[]>(
      `${clientHost(region)}/users/current/accounts/${accountId}` +
        `/history-deals/time/${start}/${end}?offset=0&limit=${limit}`
    );
  }

  async getSymbolPrice(
    accountId: string,
    symbol: string,
    region = DEFAULT_REGION
  ): Promise<SymbolPrice> {
    return this.request<SymbolPrice>(
      `${clientHost(region)}/users/current/accounts/${accountId}` +
        `/symbols/${encodeURIComponent(symbol)}/current-price?keepSubscription=true`
    );
  }

  async getSymbolSpecification(
    accountId: string,
    symbol: string,
    region = DEFAULT_REGION
  ): Promise<SymbolSpecification> {
    return this.request<SymbolSpecification>(
      `${clientHost(region)}/users/current/accounts/${accountId}` +
        `/symbols/${encodeURIComponent(symbol)}/specification`
    );
  }

  async getCandles(
    accountId: string,
    symbol: string,
    timeframe: string,
    limit = 200,
    region = DEFAULT_REGION
  ): Promise<Candle[]> {
    return this.request<Candle[]>(
      `${marketDataHost(region)}/users/current/accounts/${accountId}` +
        `/historical-market-data/symbols/${encodeURIComponent(symbol)}` +
        `/timeframes/${timeframe}/candles?limit=${limit}`
    );
  }

  /* ── Trading ───────────────────────────────────────────────── */

  async trade(
    accountId: string,
    payload: Record<string, unknown>,
    region = DEFAULT_REGION
  ): Promise<TradeResponse> {
    return this.request<TradeResponse>(
      `${clientHost(region)}/users/current/accounts/${accountId}/trade`,
      { method: "POST", body: payload }
    );
  }

  async marketOrder(
    accountId: string,
    params: {
      symbol: string;
      direction: "BUY" | "SELL";
      volume: number;
      stopLoss?: number;
      takeProfit?: number;
      magic?: number;
      comment?: string;
    },
    region = DEFAULT_REGION
  ): Promise<TradeResponse> {
    return this.trade(
      accountId,
      {
        actionType: params.direction === "BUY" ? "ORDER_TYPE_BUY" : "ORDER_TYPE_SELL",
        symbol: params.symbol,
        volume: params.volume,
        ...(params.stopLoss ? { stopLoss: params.stopLoss } : {}),
        ...(params.takeProfit ? { takeProfit: params.takeProfit } : {}),
        ...(params.magic ? { magic: params.magic } : {}),
        ...(params.comment ? { comment: params.comment.slice(0, 26) } : {}),
      },
      region
    );
  }

  async closePosition(
    accountId: string,
    positionId: string,
    region = DEFAULT_REGION
  ): Promise<TradeResponse> {
    return this.trade(
      accountId,
      { actionType: "POSITION_CLOSE_ID", positionId },
      region
    );
  }

  async modifyPosition(
    accountId: string,
    params: { positionId: string; stopLoss?: number; takeProfit?: number },
    region = DEFAULT_REGION
  ): Promise<TradeResponse> {
    return this.trade(
      accountId,
      {
        actionType: "POSITION_MODIFY",
        positionId: params.positionId,
        ...(params.stopLoss ? { stopLoss: params.stopLoss } : {}),
        ...(params.takeProfit ? { takeProfit: params.takeProfit } : {}),
      },
      region
    );
  }
}

export function isTradeSuccess(response: TradeResponse): boolean {
  // MT5 returns TRADE_RETCODE_DONE (10009); MT4 returns ERR_NO_ERROR (0).
  return (
    response.stringCode === "TRADE_RETCODE_DONE" ||
    response.stringCode === "TRADE_RETCODE_DONE_PARTIAL" ||
    response.stringCode === "ERR_NO_ERROR" ||
    response.numericCode === 10009 ||
    response.numericCode === 0
  );
}

export function accountRegion(account: Pick<TradingAccount, "region">): string {
  return account.region || DEFAULT_REGION;
}

function randomTransactionId(): string {
  const chars = "abcdef0123456789";
  let out = "";
  for (let i = 0; i < 32; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** Human-readable reason for a failed connection attempt. */
/**
 * Human-readable reason for a failed connection attempt.
 *
 * The distinction that matters: 401/403 means OUR MetaApi token is wrong,
 * which the user can do nothing about. 400 means MetaApi rejected the
 * account details — nearly always because it cannot resolve the server
 * name to a known broker — which the user can fix in about ten seconds
 * once they are told that. Conflating the two sends people to support with
 * a problem they could have solved themselves.
 */
export function describeMetaApiError(error: unknown): string {
  if (error instanceof MetaApiError) {
    if (error.status === 401 || error.status === 403) {
      return "The trading bridge rejected our access token. This is on our side — please contact support.";
    }
    if (error.status === 429) {
      return "The trading bridge is rate limited right now. Please try again in a minute.";
    }
    if (error.status === 400) {
      /*
        MetaApi's own message is usually specific ("specified server not
        found", "invalid login"). Prefer it, but always append the one thing
        that fixes most of these, because the raw message rarely says it.
      */
      const detail = (error.message || "").trim();
      const generic =
        !detail ||
        /^metaapi request failed/i.test(detail) ||
        /^bad request$/i.test(detail);

      if (generic) {
        return (
          "The trading bridge could not use these account details. Check that the " +
          "server name matches your MetaTrader terminal exactly — for example " +
          "Exness-Real9, not Exness-Real or Exness Real 9."
        );
      }
      const punctuated = /[.!?]$/.test(detail) ? detail : `${detail}.`;
      return `${punctuated} Check that the server name matches your MetaTrader terminal exactly.`;
    }
    if (error.status === 408) {
      return error.message;
    }
    return error.message;
  }
  if (error instanceof Error) {
    logError("Unexpected MetaApi failure", error);
  }
  return "Could not reach the trading bridge. Please try again.";
}

export const METAAPI_DEFAULT_REGION = DEFAULT_REGION;
