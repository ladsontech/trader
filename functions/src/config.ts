import { defineSecret } from "firebase-functions/params";

/* ────────────────────────────────────────────────────────────────
 * Secrets
 *
 * MARZPAY_API_KEY is the SAME secret Investio's payment gateway
 * uses — we are reusing the Investio payments channel, not
 * duplicating it. Nothing in the investio/ codebase is modified.
 * ──────────────────────────────────────────────────────────────── */
export const MARZPAY_API_KEY = defineSecret("MARZPAY_API_KEY");

/** MetaApi (metaapi.cloud) auth token — bridges to Exness / FBS MT5. */
export const METAAPI_TOKEN = defineSecret("METAAPI_TOKEN");

/** 32-byte base64 key used to encrypt broker passwords at rest. */
export const BROKER_ENC_KEY = defineSecret("BROKER_ENC_KEY");

/* ── Project / region ─────────────────────────────────────────── */
export const PROJECT_ID =
  process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "investio-ug";
export const REGION = process.env.FUNCTION_REGION || "us-central1";

/* ── Marz Pay ─────────────────────────────────────────────────── */
export const MARZPAY_BASE_URL = "https://wallet.wearemarz.com/api/v1";

/**
 * TradeBot has its OWN webhook so subscription payments never land in
 * Investio's `pending_transactions` ledger (which credits the payer's
 * wallet balance and pays referral commission).
 */
export const TRADEBOT_WEBHOOK_URL =
  process.env.TRADEBOT_WEBHOOK_URL ||
  `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/tbMarzPayWebhook`;

/**
 * Investio routes Marz Pay traffic through a VPC connector so the provider
 * sees a stable egress IP (their API is IP-allowlisted). We reuse the same
 * connector.
 *
 * If that connector does not exist in this project the DEPLOY fails, not the
 * request — so it has to be switchable. Set MARZPAY_VPC_CONNECTOR to an empty
 * value in functions/.env to turn it off. Note the `!== undefined` check: a
 * plain `||` would treat the empty string as "unset" and silently put the
 * default back, which is exactly the case we need to be able to disable.
 */
const MARZPAY_VPC_CONNECTOR =
  process.env.MARZPAY_VPC_CONNECTOR !== undefined
    ? process.env.MARZPAY_VPC_CONNECTOR.trim()
    : `projects/${PROJECT_ID}/locations/${REGION}/connectors/marzpay-egress`;

export const marzPayCallableOptions = {
  secrets: [MARZPAY_API_KEY],
  ...(MARZPAY_VPC_CONNECTOR
    ? {
        vpcConnector: MARZPAY_VPC_CONNECTOR,
        vpcConnectorEgressSettings: "ALL_TRAFFIC" as const,
      }
    : {}),
};

export const marzPayRequestOptions = {
  secrets: [MARZPAY_API_KEY],
  ...(MARZPAY_VPC_CONNECTOR
    ? {
        vpcConnector: MARZPAY_VPC_CONNECTOR,
        vpcConnectorEgressSettings: "ALL_TRAFFIC" as const,
      }
    : {}),
};

/* ── Firestore collections (all TradeBot-owned) ───────────────── */
export const COL = {
  users: "tradebot_users",
  transactions: "tradebot_transactions",
  activePayments: "tradebot_active_payments",
  subscriptions: "tradebot_subscriptions",
  brokers: "tradebot_broker_connections",
  trades: "tradebot_trades",
  botRuns: "tradebot_bot_runs",
} as const;

/* ── Plans (server-side source of truth for price) ────────────── */
export interface PlanDef {
  id: "standard" | "premium";
  name: string;
  price: number; // UGX fallback
  priceUgx: number;
  priceKes: number;
  /** How long one payment buys. Billing is annual. */
  durationDays: number;
  maxSymbols: number;
  symbols: string[];
  riskPercent: number; // % of equity risked per trade
  maxOpenPositions: number;
}

export const PLANS: Record<string, PlanDef> = {
  standard: {
    id: "standard",
    name: "Standard Bot",
    price: 50000,
    priceUgx: 50000,
    priceKes: 1800,
    durationDays: 365,
    maxSymbols: 3,
    symbols: ["EURUSD", "GBPUSD", "USDJPY"],
    riskPercent: 0.5,
    maxOpenPositions: 3,
  },
  premium: {
    id: "premium",
    name: "VIP Premium Bot",
    price: 100000,
    priceUgx: 100000,
    priceKes: 3500,
    durationDays: 365,
    maxSymbols: 8,
    symbols: [
      "EURUSD",
      "GBPUSD",
      "USDJPY",
      "AUDUSD",
      "USDCAD",
      "XAUUSD",
      "GBPJPY",
      "EURJPY",
    ],
    riskPercent: 1,
    maxOpenPositions: 6,
  },
};

export function getPlanPrice(plan: PlanDef, country: "UG" | "KE"): number {
  return country === "KE" ? plan.priceKes : plan.priceUgx;
}

/* ── Supported brokers (MT5 via MetaApi) ──────────────────────── */
export interface BrokerDef {
  id: string;
  name: string;
  /** Keywords MetaApi uses to auto-detect broker server settings. */
  keywords: string[];
  platform: "mt4" | "mt5";
}

export const BROKERS: Record<string, BrokerDef> = {
  exness: { id: "exness", name: "Exness", keywords: ["Exness"], platform: "mt5" },
  fbs: { id: "fbs", name: "FBS", keywords: ["FBS"], platform: "mt5" },
};

/** Hard ceiling so a bug can never blow up an account. */
export const RISK_LIMITS = {
  maxLotSize: 1.0,
  minLotSize: 0.01,
  maxDailyLossPercent: 5,
  defaultAtrStopMultiple: 1.8,
  defaultAtrTargetMultiple: 2.7,
};
