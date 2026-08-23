/**
 * Real broker connection: Exness / FBS MetaTrader 5 accounts, bridged
 * through MetaApi.
 *
 * Connecting is a genuine handshake — we provision a terminal, wait for
 * the broker to accept the credentials, and read the live account
 * balance back. If the broker refuses, the user is told so and nothing
 * is marked connected.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db } from "./firebase";
import { BROKERS, BROKER_ENC_KEY, COL, METAAPI_TOKEN } from "./config";
import { encryptSecret, maskAccount } from "./crypto-vault";
import {
  MetaApiClient,
  MetaApiError,
  accountRegion,
  describeMetaApiError,
} from "./metaapi";
import { logError, logInfo, sanitizeText } from "./util";

const brokerOptions = { secrets: [METAAPI_TOKEN, BROKER_ENC_KEY], timeoutSeconds: 300 };

async function requireActiveSubscription(uid: string) {
  const userDoc = await db.collection(COL.users).doc(uid).get();
  const data = userDoc.exists ? userDoc.data()! : null;
  const active =
    data?.subscriptionStatus === "active" &&
    Number(data?.subscriptionExpiresAt || 0) > Date.now();

  if (!active) {
    throw new HttpsError(
      "permission-denied",
      "An active subscription is required before connecting a broker."
    );
  }
  return data!;
}

/** Deterministic magic number so we can tell our trades from the user's. */
function magicForUser(uid: string): number {
  let hash = 0;
  for (let i = 0; i < uid.length; i += 1) {
    hash = (hash * 31 + uid.charCodeAt(i)) % 1_000_000;
  }
  return 700_000 + (hash % 200_000);
}

/* ────────────────────────────────────────────────────────────────
 * tbConnectBroker
 * ──────────────────────────────────────────────────────────────── */
export const tbConnectBroker = onCall(brokerOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please sign in first.");
  }
  const uid = request.auth.uid;
  await requireActiveSubscription(uid);

  const { brokerId, accountId, password, server } = (request.data || {}) as {
    brokerId?: string;
    accountId?: string;
    password?: string;
    server?: string;
  };

  const broker = brokerId ? BROKERS[brokerId] : undefined;
  if (!broker) {
    throw new HttpsError("invalid-argument", "Choose a supported broker.");
  }
  if (!accountId || !/^\d{4,12}$/.test(accountId.trim())) {
    throw new HttpsError(
      "invalid-argument",
      "Enter your MT5 account number (digits only)."
    );
  }
  if (!password || password.length < 4) {
    throw new HttpsError("invalid-argument", "Enter your MT5 password.");
  }
  if (!server || server.trim().length < 3) {
    throw new HttpsError(
      "invalid-argument",
      "Enter the exact server name shown in your MT5 terminal, e.g. Exness-Real9."
    );
  }

  const client = new MetaApiClient(METAAPI_TOKEN.value());
  const connRef = db.collection(COL.brokers).doc(uid);
  const existing = await connRef.get();

  // Replace any previous terminal for this user so we never leak accounts.
  const previousMetaAccountId = existing.exists
    ? (existing.data()!.metaApiAccountId as string | undefined)
    : undefined;

  let metaAccountId = "";
  try {
    const created = await client.createAccount({
      name: `tradebot-${uid.slice(0, 10)}`,
      login: accountId.trim(),
      password,
      server: server.trim(),
      platform: broker.platform,
      keywords: broker.keywords,
      magic: magicForUser(uid),
    });
    metaAccountId = created.id;

    if (created.state !== "DEPLOYED" && created.state !== "DEPLOYING") {
      await client.deployAccount(metaAccountId);
    }

    const account = await client.waitConnected(metaAccountId, 240_000, 4_000);
    const region = accountRegion(account);
    const info = await client.getAccountInformation(metaAccountId, region);

    await connRef.set(
      {
        userId: uid,
        brokerId: broker.id,
        brokerName: broker.name,
        platform: broker.platform,
        login: accountId.trim(),
        loginMasked: maskAccount(accountId.trim()),
        server: server.trim(),
        // Reversible only inside Cloud Functions; never sent to a client.
        passwordEncrypted: encryptSecret(password, BROKER_ENC_KEY.value()),
        metaApiAccountId: metaAccountId,
        region,
        magic: magicForUser(uid),
        connected: true,
        connectionStatus: account.connectionStatus,
        accountCurrency: info.currency,
        accountBroker: info.broker,
        leverage: info.leverage,
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await db.collection(COL.users).doc(uid).set(
      {
        broker: broker.name,
        brokerId: broker.id,
        brokerConnected: true,
        brokerAccountId: maskAccount(accountId.trim()),
        brokerServer: server.trim(),
        brokerCurrency: info.currency,
        botEnabled: true,
        brokerConnectedAt: Date.now(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Clean up the old terminal only after the new one works.
    if (previousMetaAccountId && previousMetaAccountId !== metaAccountId) {
      client
        .undeployAccount(previousMetaAccountId)
        .then(() => client.deleteAccount(previousMetaAccountId))
        .catch((error) =>
          logError("Failed removing previous MetaApi account", error, {
            previousMetaAccountId,
          })
        );
    }

    logInfo("Broker connected", { uid, brokerId: broker.id });

    return {
      success: true,
      broker: broker.name,
      currency: info.currency,
      balance: info.balance,
      equity: info.equity,
      leverage: info.leverage,
      server: info.server,
      accountMasked: maskAccount(accountId.trim()),
    };
  } catch (error) {
    // Roll back: never leave a paid-for terminal running that we lost track of.
    if (metaAccountId) {
      client
        .undeployAccount(metaAccountId)
        .then(() => client.deleteAccount(metaAccountId))
        .catch(() => undefined);
    }
    /*
      Record what was actually attempted. The server string is the field that
      causes most failures and it is not a secret, so log it verbatim — without
      it, "connection failed" tells whoever is on call nothing. The password is
      never included; `logError` redacts, and it is not passed here anyway.
    */
    logError("Broker connection failed", error, {
      uid,
      brokerId: broker.id,
      server: server.trim(),
      loginMasked: maskAccount(accountId.trim()),
      metaApiStatus: error instanceof MetaApiError ? error.status : undefined,
      metaApiDetails: error instanceof MetaApiError ? error.details : undefined,
    });
    throw new HttpsError("failed-precondition", describeMetaApiError(error));
  }
});

/* ────────────────────────────────────────────────────────────────
 * tbDisconnectBroker
 * ──────────────────────────────────────────────────────────────── */
export const tbDisconnectBroker = onCall(brokerOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please sign in first.");
  }
  const uid = request.auth.uid;
  const connRef = db.collection(COL.brokers).doc(uid);
  const snap = await connRef.get();

  if (snap.exists) {
    const metaAccountId = snap.data()!.metaApiAccountId as string | undefined;
    if (metaAccountId) {
      const client = new MetaApiClient(METAAPI_TOKEN.value());
      try {
        await client.undeployAccount(metaAccountId);
        await client.deleteAccount(metaAccountId);
      } catch (error) {
        logError("Failed to remove MetaApi account", error, { uid });
      }
    }
    await connRef.delete();
  }

  await db.collection(COL.users).doc(uid).set(
    {
      broker: null,
      brokerId: null,
      brokerConnected: false,
      brokerAccountId: null,
      brokerServer: null,
      botEnabled: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { success: true };
});

/* ────────────────────────────────────────────────────────────────
 * tbBrokerState — live balance / equity / margin
 * ──────────────────────────────────────────────────────────────── */
export const tbBrokerState = onCall(
  { secrets: [METAAPI_TOKEN], timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Please sign in first.");
    }
    const uid = request.auth.uid;
    const snap = await db.collection(COL.brokers).doc(uid).get();
    if (!snap.exists) {
      return { connected: false };
    }

    const conn = snap.data()!;
    const client = new MetaApiClient(METAAPI_TOKEN.value());
    const region = (conn.region as string) || undefined;

    try {
      const [info, positions] = await Promise.all([
        client.getAccountInformation(conn.metaApiAccountId as string, region),
        client.getPositions(conn.metaApiAccountId as string, region),
      ]);

      await snap.ref.set(
        {
          connected: true,
          lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
          lastEquity: info.equity,
          lastBalance: info.balance,
        },
        { merge: true }
      );

      return {
        connected: true,
        broker: conn.brokerName,
        server: info.server,
        accountMasked: conn.loginMasked,
        currency: info.currency,
        balance: info.balance,
        equity: info.equity,
        margin: info.margin,
        freeMargin: info.freeMargin,
        marginLevel: info.marginLevel ?? null,
        leverage: info.leverage,
        tradeAllowed: info.tradeAllowed ?? true,
        openPositions: positions.length,
        floatingPnl: positions.reduce((sum, p) => sum + (p.profit || 0), 0),
      };
    } catch (error) {
      logError("Broker state read failed", error, { uid });
      return {
        connected: false,
        broker: conn.brokerName,
        accountMasked: conn.loginMasked,
        error: sanitizeText(describeMetaApiError(error)),
      };
    }
  }
);
