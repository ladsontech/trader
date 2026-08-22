/**
 * Trend-following signal engine.
 *
 * Deliberately simple and fully auditable: EMA trend filter + RSI pullback
 * trigger + ATR-based stop and target. No magic numbers hidden in a black
 * box — everything a user sees on the Trades page can be traced back to
 * the candles that produced it.
 *
 * This is not a promise of profit. It is a mechanical rule set with hard
 * risk limits, which is the honest thing to ship.
 */
import type { Candle } from "./metaapi";

export interface Signal {
  direction: "BUY" | "SELL";
  reason: string;
  entryReference: number;
  atr: number;
  fastEma: number;
  slowEma: number;
  rsi: number;
  strength: number; // 0..1
}

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / Math.min(period, values.length);
  for (let i = 0; i < values.length; i += 1) {
    if (i < period - 1) {
      out.push(NaN);
      continue;
    }
    if (i === period - 1) {
      out.push(prev);
      continue;
    }
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function rsi(values: number[], period = 14): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length <= period) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function atr(candles: Candle[], period = 14): number[] {
  const out: number[] = new Array(candles.length).fill(NaN);
  if (candles.length <= period) return out;

  const trueRanges: number[] = [0];
  for (let i = 1; i < candles.length; i += 1) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    trueRanges.push(
      Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose))
    );
  }

  let sum = 0;
  for (let i = 1; i <= period; i += 1) sum += trueRanges[i];
  let value = sum / period;
  out[period] = value;

  for (let i = period + 1; i < candles.length; i += 1) {
    value = (value * (period - 1) + trueRanges[i]) / period;
    out[i] = value;
  }
  return out;
}

const FAST_EMA = 21;
const SLOW_EMA = 55;
const RSI_PERIOD = 14;
const ATR_PERIOD = 14;

/**
 * Candles must be oldest → newest.
 * Returns null when no rule fires — which is most of the time, by design.
 */
export function evaluate(candles: Candle[]): Signal | null {
  if (candles.length < SLOW_EMA + 10) return null;

  const closes = candles.map((c) => c.close);
  const fast = ema(closes, FAST_EMA);
  const slow = ema(closes, SLOW_EMA);
  const rsiValues = rsi(closes, RSI_PERIOD);
  const atrValues = atr(candles, ATR_PERIOD);

  const i = candles.length - 1;
  const fastNow = fast[i];
  const slowNow = slow[i];
  const rsiNow = rsiValues[i];
  const rsiPrev = rsiValues[i - 1];
  const atrNow = atrValues[i];
  const close = closes[i];

  if (![fastNow, slowNow, rsiNow, rsiPrev, atrNow].every((v) => Number.isFinite(v))) {
    return null;
  }
  if (atrNow <= 0) return null;

  // Spread sanity: skip a symbol whose spread eats more than 25% of ATR.
  const spread = candles[i].spread || 0;
  if (spread > 0 && spread > atrNow * 0.25) return null;

  const separation = Math.abs(fastNow - slowNow) / atrNow;
  // Require a real trend, not noise around a flat pair.
  if (separation < 0.25) return null;

  const uptrend = fastNow > slowNow && close > slowNow;
  const downtrend = fastNow < slowNow && close < slowNow;

  // Pullback trigger: RSI dipped into the reset zone and is turning back
  // in the direction of the trend.
  if (uptrend && rsiPrev < 45 && rsiNow >= rsiPrev && rsiNow < 65) {
    return {
      direction: "BUY",
      reason: `Uptrend (EMA${FAST_EMA} above EMA${SLOW_EMA}) with RSI turning up from ${rsiPrev.toFixed(1)}`,
      entryReference: close,
      atr: atrNow,
      fastEma: fastNow,
      slowEma: slowNow,
      rsi: rsiNow,
      strength: Math.min(1, separation / 2),
    };
  }

  if (downtrend && rsiPrev > 55 && rsiNow <= rsiPrev && rsiNow > 35) {
    return {
      direction: "SELL",
      reason: `Downtrend (EMA${FAST_EMA} below EMA${SLOW_EMA}) with RSI rolling over from ${rsiPrev.toFixed(1)}`,
      entryReference: close,
      atr: atrNow,
      fastEma: fastNow,
      slowEma: slowNow,
      rsi: rsiNow,
      strength: Math.min(1, separation / 2),
    };
  }

  return null;
}

/**
 * Position size from account risk, stop distance and the symbol's contract
 * specification. Falls back conservatively whenever anything is unknown —
 * an unknown never becomes a bigger trade.
 */
export function positionSize(params: {
  equity: number;
  riskPercent: number;
  stopDistance: number; // in price terms
  tickSize: number;
  tickValue: number; // account currency per tick per 1 lot
  minVolume: number;
  maxVolume: number;
  volumeStep: number;
  hardMaxLots: number;
}): number {
  const {
    equity, riskPercent, stopDistance, tickSize, tickValue,
    minVolume, maxVolume, volumeStep, hardMaxLots,
  } = params;

  if (![equity, stopDistance, tickSize, tickValue].every((v) => Number.isFinite(v) && v > 0)) {
    return 0;
  }

  const riskAmount = equity * (riskPercent / 100);
  const ticksAtRisk = stopDistance / tickSize;
  const lossPerLot = ticksAtRisk * tickValue;
  if (lossPerLot <= 0) return 0;

  let lots = riskAmount / lossPerLot;
  lots = Math.min(lots, maxVolume, hardMaxLots);

  const step = volumeStep > 0 ? volumeStep : 0.01;
  lots = Math.floor(lots / step) * step;
  lots = Number(lots.toFixed(4));

  if (lots < minVolume) return 0; // too small to trade safely — skip
  return lots;
}

export const STRATEGY_META = {
  name: "EMA Pullback Trend",
  fastEma: FAST_EMA,
  slowEma: SLOW_EMA,
  rsiPeriod: RSI_PERIOD,
  atrPeriod: ATR_PERIOD,
  timeframe: "15m",
};
