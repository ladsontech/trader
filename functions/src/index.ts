/**
 * TradeBot Cloud Functions — codebase "tradebot".
 *
 * Deployed to the same Firebase project as Investio but as a SEPARATE
 * codebase, so `firebase deploy --only functions:tradebot` never touches
 * Investio's functions, and Investio deploys never touch these.
 *
 * Every export is prefixed `tb` for the same reason.
 */
import "./firebase";

export {
  tbInitiateSubscription,
  tbMarzPayWebhook,
  tbCheckPayment,
} from "./payments";

export {
  tbConnectBroker,
  tbDisconnectBroker,
  tbBrokerState,
} from "./broker";

export {
  tbGetTrades,
  tbClosePosition,
  tbSetBotEnabled,
  tbBotTick,
  tbDailyMaintenance,
} from "./trading";
