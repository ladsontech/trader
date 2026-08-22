/**
 * Live trading: real positions, real history, and a scheduled loop that
 * places genuine orders on the user's connected MT5 account.
 *
 * Every order carries the user's magic number, an ATR stop loss and an
 * ATR take profit. The loop refuses to trade when the subscription has
 * lapsed, when the daily loss limit is hit, or when position sizing comes
 * out below the broker's minimum lot.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";
import { db } from "./firebase";
import { COL, METAAPI_TOKEN, PLANS, RISK_LIMITS } from "./config";
import {
  MetaApiClient,
  isTradeSuccess,
  type Position,
  type Deal,
} from "./metaapi";
import { STRATEGY_META, evaluate, positionSize } from "./strategy";
import { expireLapsedSubscriptions } from "./payments";
import { logError, logInfo, sanitizeText } from "./util";

const readOptions = { secrets: [METAAPI_TOKEN], timeoutSeconds: 60 };

function mapPosition(p: Position) {
  return {
    id: p.id,
    symbol: p.symbol,
    direction: p.type === "POSITION_TYPE_BUY" ? "BUY" : "SELL",
    volume: p.volume,
    openPrice: p.openPrice,
    currentPrice: p.currentPrice ?? null,
    stopLoss: p.stopLoss ?? null,
    takeProfit: p.takeProfit ?? null,
    profit: p.profit ?? 0,
    swap: p.swap ?? 0,
    commission: p.commission ?? 0,
    openedAt: Date.parse(p.time) || null,
    comment: p.comment ?? null,
    status: "open" as const,
  };
}

function mapDeal(d: Deal) {
  return {
    id: d.id,
    symbol: d.symbol ?? null,
    type: d.type,
    entryType: d.entryType ?? null,
    volume: d.volume ?? 0,
    price: d.price ?? 0,
    profit: d.profit ?? 0,
    commission: d.commission ?? 0,
    swap: d.swap ?? 0,
    positionId: d.positionId ?? null,
    closedAt: Date.parse(d.time) || null,
    comment: d.comment ?? null,
    status: "closed" as const,
  };
}

async function loadConnection(uid: string) {
  const snap = await db.collection(COL.brokers).doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError(
      "failed-precondition",
      "Connect your broker account first."
    );
  }
  return snap.data()!;
}

/* ────────────────────────────────────────────────────────────────
 * tbGetTrades — live open positions + closed deals
 * ──────────────────────────────────────────────────────────────── */
export const tbGetTrades = onCall(readOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please sign in first.");
  }
  const uid = request.auth.uid;
  const conn = await loadConnection(uid);
  const client = new MetaApiClient(METAAPI_TOKEN.value());
  const accountId = conn.metaApiAccountId as string;
  const region = (conn.region as string) || undefined;

  const days = Math.min(Number((request.data || {}).days) || 30, 180);
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  try {
    const [positions, deals] = await Promise.all([
      client.getPositions(accountId, region),
      client.getDealsByTimeRange(accountId, start, end, region, 500),
    ]);

    const closed = deals
      .filter((d) => d.entryType === "DEAL_ENTRY_OUT" || d.type === "DEAL_TYPE_SELL" || d.type === "DEAL_TYPE_BUY")
      .filter((d) => d.symbol)
      .map(mapDeal)
      .sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));

    const realized = closed.reduce(
      (sum, d) => sum + d.profit + d.commission + d.swap,
      0
    );
    const wins = closed.filter((d) => d.profit > 0).length;
    const losses = closed.filter((d) => d.profit < 0).length;

    return {
      open: positions.map(mapPosition),
      closed: closed.slice(0, 200),
      stats: {
        openCount: positions.length,
        closedCount: closed.length,
        floatingPnl: positions.reduce((sum, p) => sum + (p.profit || 0), 0),
        realizedPnl: realized,
        winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
        wins,
        losses,
      },
    };
  } catch (error) {
    logError("Failed to load trades", error, { uid });
    throw new HttpsError(
      "unavailable",
      "Could not reach your broker account right now. Please try again shortly."
    );
  }
});

/* ────────────────────────────────────────────────────────────────
 * tbClosePosition — manual override
 * ──────────────────────────────────────────────────────────────── */
export const tbClosePosition = onCall(readOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please sign in first.");
  }
  const uid = request.auth.uid;
  const { positionId } = (request.data || {}) as { positionId?: string };
  if (!positionId) {
    throw new HttpsError("invalid-argument", "Missing position id.");
  }

  const conn = await loadConnection(uid);
  const client = new MetaApiClient(METAAPI_TOKEN.value());

  const result = await client.closePosition(
    conn.metaApiAccountId as string,
    positionId,
    (conn.region as string) || undefined
  );

  if (!isTradeSuccess(result)) {
    throw new HttpsError(
      "aborted",
      sanitizeText(result.message || "The broker rejected the close request.")
    );
  }
  logInfo("Position closed manually", { uid, positionId });
  return { success: true, message: result.message };
});

/* ────────────────────────────────────────────────────────────────
 * tbSetBotEnabled — user pause switch
 * ──────────────────────────────────────────────────────────────── */
export const tbSetBotEnabled = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please sign in first.");
  }
  const enabled = Boolean((request.data || {}).enabled);
  await db.collection(COL.users).doc(request.auth.uid).set(
    {
      botEnabled: enabled,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { success: true, botEnabled: enabled };
});

/* ────────────────────────────────────────────────────────────────
 * The bot loop
 * ──────────────────────────────────────────────────────────────── */
interface RunOutcome {
  uid: string;
  placed: number;
  skipped: string[];
  error?: string;
}

async function runForUser(
  client: MetaApiClient,
  uid: string,
  user: FirebaseFirestore.DocumentData
): Promise<RunOutcome> {
  const outcome: RunOutcome = { uid, placed: 0, skipped: [] };

  const plan = PLANS[user.subscriptionPlan as string];
  if (!plan) {
    outcome.skipped.push("no-plan");
    return outcome;
  }

  const connSnap = await db.collection(COL.brokers).doc(uid).get();
  if (!connSnap.exists) {
    outcome.skipped.push("no-broker");
    return outcome;
  }
  const conn = connSnap.data()!;
  const accountId = conn.metaApiAccountId as string;
  const region = (conn.region as string) || undefined;
  const magic = Number(conn.magic) || 0;

  const info = await client.getAccountInformation(accountId, region);
  if (info.tradeAllowed === false) {
    outcome.skipped.push("trading-disabled-by-broker");
    return outcome;
  }

  const positions = await client.getPositions(accountId, region);
  const ourPositions = positions.filter((p) => !magic || p.magic === magic);

  if (ourPositions.length >= plan.maxOpenPositions) {
    outcome.skipped.push("max-positions");
    return outcome;
  }

  // Daily loss circuit breaker.
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const todaysDeals = await client.getDealsByTimeRange(
    accountId,
    dayStart,
    new Date(),
    region,
    500
  );
  const realizedToday = todaysDeals
    .filter((d) => !magic || d.magic === magic)
    .reduce((sum, d) => sum + (d.profit || 0) + (d.commission || 0) + (d.swap || 0), 0);

  if (
    info.equity > 0 &&
    realizedToday < 0 &&
    Math.abs(realizedToday) / info.equity * 100 >= RISK_LIMITS.maxDailyLossPercent
  ) {
    outcome.skipped.push("daily-loss-limit");
    return outcome;
  }

  const heldSymbols = new Set(ourPositions.map((p) => p.symbol));
  const symbols = plan.symbols.slice(0, plan.maxSymbols);

  for (const symbol of symbols) {
    if (ourPositions.length + outcome.placed >= plan.maxOpenPositions) break;
    if (heldSymbols.has(symbol)) continue;

    try {
      const candles = await client.getCandles(
        accountId,
        symbol,
        STRATEGY_META.timeframe,
        200,
        region
      );
      if (candles.length < 80) {
        outcome.skipped.push(`${symbol}:insufficient-data`);
        continue;
      }

      const signal = evaluate(candles);
      if (!signal) continue;

      const [spec, price] = await Promise.all([
        client.getSymbolSpecification(accountId, symbol, region),
        client.getSymbolPrice(accountId, symbol, region),
      ]);

      const entry = signal.direction === "BUY" ? price.ask : price.bid;
      const stopDistance = signal.atr * RISK_LIMITS.defaultAtrStopMultiple;
      const targetDistance = signal.atr * RISK_LIMITS.defaultAtrTargetMultiple;

      const stopLoss =
        signal.direction === "BUY" ? entry - stopDistance : entry + stopDistance;
      const takeProfit =
        signal.direction === "BUY" ? entry + targetDistance : entry - targetDistance;

      const tickValue =
        signal.direction === "BUY"
          ? price.lossTickValue ?? price.profitTickValue ?? 0
          : price.lossTickValue ?? price.profitTickValue ?? 0;

      const volume = positionSize({
        equity: info.equity,
        riskPercent: plan.riskPercent,
        stopDistance,
        tickSize: spec.tickSize,
        tickValue,
        minVolume: spec.minVolume ?? RISK_LIMITS.minLotSize,
        maxVolume: spec.maxVolume ?? RISK_LIMITS.maxLotSize,
        volumeStep: spec.volumeStep ?? 0.01,
        hardMaxLots: RISK_LIMITS.maxLotSize,
      });

      if (volume <= 0) {
        outcome.skipped.push(`${symbol}:size-below-minimum`);
        continue;
      }

      const digits = spec.digits ?? 5;
      const response = await client.marketOrder(
        accountId,
        {
          symbol,
          direction: signal.direction,
          volume,
          stopLoss: Number(stopLoss.toFixed(digits)),
          takeProfit: Number(takeProfit.toFixed(digits)),
          magic,
          comment: "TradeBot",
        },
        region
      );

      const success = isTradeSuccess(response);

      await db.collection(COL.trades).add({
        userId: uid,
        symbol,
        direction: signal.direction,
        volume,
        requestedEntry: entry,
        stopLoss: Number(stopLoss.toFixed(digits)),
        takeProfit: Number(takeProfit.toFixed(digits)),
        atr: signal.atr,
        rsi: signal.rsi,
        strength: signal.strength,
        reason: signal.reason,
        strategy: STRATEGY_META.name,
        timeframe: STRATEGY_META.timeframe,
        brokerOrderId: response.orderId ?? null,
        brokerPositionId: response.positionId ?? null,
        accepted: success,
        brokerMessage: sanitizeText(response.message || response.stringCode),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (success) {
        outcome.placed += 1;
        heldSymbols.add(symbol);
      } else {
        outcome.skipped.push(`${symbol}:${response.stringCode}`);
      }
    } catch (error) {
      logError("Symbol evaluation failed", error, { uid, symbol });
      outcome.skipped.push(`${symbol}:error`);
    }
  }

  await db.collection(COL.users).doc(uid).set(
    {
      lastBotRunAt: Date.now(),
      lastEquity: info.equity,
      lastBalance: info.balance,
      accountCurrency: info.currency,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return outcome;
}

/**
 * Runs every 15 minutes during the forex week. Weekends are skipped
 * because the market is closed.
 */
export const tbBotTick = onSchedule(
  {
    schedule: "*/15 * * * *",
    timeZone: "UTC",
    secrets: [METAAPI_TOKEN],
    timeoutSeconds: 540,
    memory: "512MiB",
    retryCount: 0,
  },
  async () => {
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();

    // Forex week: Sunday 22:00 UTC → Friday 21:00 UTC.
    const marketOpen =
      !(day === 6) &&
      !(day === 0 && hour < 22) &&
      !(day === 5 && hour >= 21);

    if (!marketOpen) {
      logInfo("Market closed, skipping bot tick");
      return;
    }

    await expireLapsedSubscriptions();

    const snap = await db
      .collection(COL.users)
      .where("subscriptionStatus", "==", "active")
      .where("brokerConnected", "==", true)
      .where("botEnabled", "==", true)
      .limit(100)
      .get();

    if (snap.empty) {
      logInfo("No eligible accounts for this tick");
      return;
    }

    const client = new MetaApiClient(METAAPI_TOKEN.value());
    const outcomes: RunOutcome[] = [];

    for (const doc of snap.docs) {
      const user = doc.data();
      if (Number(user.subscriptionExpiresAt || 0) <= Date.now()) continue;
      try {
        outcomes.push(await runForUser(client, doc.id, user));
      } catch (error) {
        logError("Bot run failed for user", error, { uid: doc.id });
        outcomes.push({
          uid: doc.id,
          placed: 0,
          skipped: [],
          error: sanitizeText(error instanceof Error ? error.message : String(error)),
        });
      }
    }

    const placed = outcomes.reduce((sum, o) => sum + o.placed, 0);
    await db.collection(COL.botRuns).add({
      ranAt: admin.firestore.FieldValue.serverTimestamp(),
      accounts: outcomes.length,
      ordersPlaced: placed,
      strategy: STRATEGY_META.name,
      outcomes: outcomes.slice(0, 50),
    });

    logInfo("Bot tick complete", { accounts: outcomes.length, ordersPlaced: placed });
  }
);

/** Daily housekeeping — expire lapsed subscriptions even on weekends. */
export const tbDailyMaintenance = onSchedule(
  { schedule: "10 3 * * *", timeZone: "UTC", timeoutSeconds: 120 },
  async () => {
    const expired = await expireLapsedSubscriptions();
    logInfo("Daily maintenance complete", { expired });
  }
);
