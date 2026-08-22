/**
 * TradeBot subscription payments.
 *
 * Reuses the Investio Marz Pay mobile-money gateway (same provider, same
 * MARZPAY_API_KEY secret, same egress connector) but keeps its own ledger
 * so that paying for a bot subscription NEVER credits the payer's Investio
 * wallet balance or triggers Investio's 30% referral commission.
 *
 * Subscription activation happens here, server-side, on a verified
 * provider callback — never from the browser.
 */
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { db } from "./firebase";
import {
  COL,
  MARZPAY_API_KEY,
  MARZPAY_BASE_URL,
  PLANS,
  TRADEBOT_WEBHOOK_URL,
  marzPayCallableOptions,
  marzPayRequestOptions,
} from "./config";
import {
  extractProviderIds,
  extractWebhookFields,
  formatPhone,
  generateReference,
  isFailureStatus,
  isSuccessStatus,
  isValidUgandanPhone,
  logError,
  logInfo,
  normalizeUgandanPhone,
  providerErrorMessage,
  providerSnapshot,
  sanitizeText,
  timestampToMillis,
} from "./util";

const PROMPT_WINDOW_MS = 5 * 60 * 1000;

function marzPayAuthHeader(secretValue: string): string {
  const trimmed = secretValue.trim();
  if (trimmed.startsWith("Basic ")) return trimmed;
  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf-8");
    if (decoded.includes(":") && /^[\x20-\x7E]*$/.test(decoded)) {
      return `Basic ${trimmed}`;
    }
  } catch {
    /* fall through */
  }
  return "Basic " + Buffer.from(trimmed + ":").toString("base64");
}

/* ────────────────────────────────────────────────────────────────
 * tbInitiateSubscription
 * ──────────────────────────────────────────────────────────────── */
export const tbInitiateSubscription = onCall(
  marzPayCallableOptions,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Please sign in first.");
    }
    const uid = request.auth.uid;
    const { planId, phoneNumber } = (request.data || {}) as {
      planId?: string;
      phoneNumber?: string;
    };

    const plan = planId ? PLANS[planId] : undefined;
    if (!plan) {
      throw new HttpsError("invalid-argument", "Choose a valid package.");
    }
    if (!phoneNumber || !isValidUgandanPhone(phoneNumber)) {
      throw new HttpsError(
        "invalid-argument",
        "Enter a valid MTN or Airtel number, e.g. 0770123456."
      );
    }

    const formattedPhone = formatPhone(phoneNumber);
    const localPhone = normalizeUgandanPhone(phoneNumber);

    // Reuse a live prompt instead of spamming the user's handset.
    //
    // This is a single document lookup by uid, NOT a compound query. A
    // where(userId).where(status).orderBy(createdAt) query would need a
    // composite index that does not exist on a fresh project, and Firestore
    // would throw FAILED_PRECONDITION on the very first payment. Same reason
    // Investio keeps an `active_deposits/{uid}` document.
    const activeRef = db.collection(COL.activePayments).doc(uid);
    const activeSnap = await activeRef.get();

    if (activeSnap.exists) {
      const active = activeSnap.data()!;
      const age = Date.now() - timestampToMillis(active.createdAt);
      if (active.status === "pending" && age < PROMPT_WINDOW_MS && active.reference) {
        return {
          success: true,
          reused: true,
          reference: active.reference as string,
          planId: active.planId as string,
          amount: Number(active.amount) || plan.price,
          message:
            "A mobile money prompt is already waiting on your phone. Enter your PIN to finish.",
        };
      }
    }

    const reference = generateReference();
    const txRef = db.collection(COL.transactions).doc(reference);

    const openingBatch = db.batch();
    openingBatch.set(txRef, {
      userId: uid,
      type: "subscription",
      planId: plan.id,
      planName: plan.name,
      amount: plan.price,
      currency: "UGX",
      durationDays: plan.durationDays,
      phoneNumber: formattedPhone,
      phoneDigits: localPhone,
      reference,
      status: "creating",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    openingBatch.set(activeRef, {
      userId: uid,
      reference,
      planId: plan.id,
      amount: plan.price,
      status: "creating",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await openingBatch.commit();

    try {
      const authHeader = marzPayAuthHeader(MARZPAY_API_KEY.value());

      const formData = new FormData();
      formData.append("phone_number", formattedPhone);
      formData.append("amount", String(plan.price));
      formData.append("country", "UG");
      formData.append("reference", reference);
      formData.append("callback_url", TRADEBOT_WEBHOOK_URL);
      formData.append(
        "description",
        `TradeBot ${plan.name} subscription - UGX ${plan.price.toLocaleString()}`
      );

      const response = await fetch(`${MARZPAY_BASE_URL}/collect-money`, {
        method: "POST",
        headers: { Authorization: authHeader },
        body: formData,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        logError("Marz Pay collect failed", undefined, {
          reference,
          snapshot: providerSnapshot(result),
        });
        const failureBatch = db.batch();
        failureBatch.set(
          txRef,
          {
            status: "failed",
            failureReason: sanitizeText(
              providerErrorMessage(result, "The payment request was rejected.")
            ),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        failureBatch.delete(activeRef);
        await failureBatch.commit();
        throw new HttpsError(
          "internal",
          "We could not send the payment prompt. Please check the number and try again."
        );
      }

      const providerIds = extractProviderIds(result);
      const providerReference = providerIds.find((id) => id !== reference);

      const pendingBatch = db.batch();
      pendingBatch.set(
        txRef,
        {
          status: "pending",
          ...(providerIds.length ? { providerIds } : {}),
          ...(providerReference ? { providerReference } : {}),
          providerSnapshot: providerSnapshot(result),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      pendingBatch.set(
        activeRef,
        { status: "pending", updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      await pendingBatch.commit();

      logInfo("TradeBot subscription prompt sent", { reference, planId: plan.id });

      return {
        success: true,
        reused: false,
        reference,
        planId: plan.id,
        amount: plan.price,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logError("Subscription initiation failed", error, { reference });
      await txRef
        .set(
          {
            status: "failed",
            failureReason: "Could not start the payment.",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
        .catch(() => undefined);
      await activeRef.delete().catch(() => undefined);
      throw new HttpsError(
        "internal",
        "Could not start the payment. Please try again."
      );
    }
  }
);

/* ────────────────────────────────────────────────────────────────
 * Activation (single writer for subscription state)
 * ──────────────────────────────────────────────────────────────── */
async function activateSubscription(reference: string): Promise<void> {
  const txRef = db.collection(COL.transactions).doc(reference);

  await db.runTransaction(async (transaction) => {
    const txDoc = await transaction.get(txRef);
    if (!txDoc.exists) return;

    const tx = txDoc.data()!;
    if (tx.status === "completed") return; // idempotent

    const plan = PLANS[tx.planId as string];
    if (!plan) {
      transaction.set(
        txRef,
        {
          status: "failed",
          failureReason: "Unknown package.",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return;
    }

    const userRef = db.collection(COL.users).doc(tx.userId as string);
    const userDoc = await transaction.get(userRef);
    const existing = userDoc.exists ? userDoc.data()! : {};

    // Stack renewals onto whatever time is left.
    const now = Date.now();
    const currentExpiry = Number(existing.subscriptionExpiresAt) || 0;
    const base = currentExpiry > now ? currentExpiry : now;
    const expiresAt = base + plan.durationDays * 24 * 60 * 60 * 1000;

    transaction.set(
      userRef,
      {
        subscriptionPlan: plan.id,
        subscriptionStatus: "active",
        subscriptionExpiresAt: expiresAt,
        subscriptionActivatedAt: now,
        subscriptionReference: reference,
        phoneDigits: existing.phoneDigits || tx.phoneDigits || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const subRef = db.collection(COL.subscriptions).doc(reference);
    transaction.set(subRef, {
      userId: tx.userId,
      planId: plan.id,
      planName: plan.name,
      amount: tx.amount,
      currency: "UGX",
      reference,
      phoneNumber: tx.phoneNumber,
      startedAt: now,
      expiresAt,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    transaction.set(
      txRef,
      {
        status: "completed",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Release the handset lock so the user can pay again immediately.
    transaction.delete(db.collection(COL.activePayments).doc(tx.userId as string));
  });

  logInfo("TradeBot subscription activated", { reference });
}

async function failTransaction(reference: string, reason: string): Promise<void> {
  const txRef = db.collection(COL.transactions).doc(reference);
  const txDoc = await txRef.get();

  const batch = db.batch();
  batch.set(
    txRef,
    {
      status: "failed",
      failureReason: sanitizeText(reason || "The payment did not go through."),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const uid = txDoc.exists ? (txDoc.data()!.userId as string | undefined) : undefined;
  if (uid) batch.delete(db.collection(COL.activePayments).doc(uid));

  await batch.commit();
}

/** Resolve a provider reference back to our transaction document. */
async function findTransaction(
  reference: string
): Promise<FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot | null> {
  const collection = db.collection(COL.transactions);

  const direct = await collection.doc(reference).get();
  if (direct.exists) return direct;

  const byArray = await collection
    .where("providerIds", "array-contains", reference)
    .limit(1)
    .get();
  if (!byArray.empty) return byArray.docs[0];

  const byField = await collection
    .where("providerReference", "==", reference)
    .limit(1)
    .get();
  if (!byField.empty) return byField.docs[0];

  return null;
}

/* ────────────────────────────────────────────────────────────────
 * tbMarzPayWebhook — TradeBot's own callback endpoint
 * ──────────────────────────────────────────────────────────────── */
export const tbMarzPayWebhook = onRequest(
  marzPayRequestOptions,
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    try {
      const fields = extractWebhookFields(req.body);
      const reference = fields.reference;

      if (!reference) {
        res.status(400).send("Missing reference");
        return;
      }

      const doc = await findTransaction(reference);
      if (!doc) {
        // Not ours — Investio's own webhook owns that reference.
        logInfo("TradeBot webhook: reference not ours", { reference });
        res.status(404).send("Transaction not found");
        return;
      }

      const data = doc.data()!;
      const canonicalReference = (data.reference as string) || doc.id;

      if (data.status === "completed" || data.status === "failed") {
        res.status(200).send("Already processed");
        return;
      }

      await doc.ref.set(
        {
          providerSnapshot: providerSnapshot(req.body),
          ...(fields.providerStatus ? { providerStatus: fields.providerStatus } : {}),
          ...(fields.eventType ? { providerEventType: fields.eventType } : {}),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      if (isSuccessStatus(fields.providerStatus, fields.eventType)) {
        await activateSubscription(canonicalReference);
        res.status(200).send("Completed");
        return;
      }

      if (isFailureStatus(fields.providerStatus, fields.eventType)) {
        await failTransaction(
          canonicalReference,
          fields.failureReason || "The mobile money payment was declined or timed out."
        );
        res.status(200).send("Failed");
        return;
      }

      res.status(200).send("Pending");
    } catch (error) {
      logError("TradeBot webhook error", error);
      res.status(500).send("Webhook error");
    }
  }
);

/* ────────────────────────────────────────────────────────────────
 * tbCheckPayment — client-side poll fallback if the callback is late
 * ──────────────────────────────────────────────────────────────── */
export const tbCheckPayment = onCall(marzPayCallableOptions, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please sign in first.");
  }
  const { reference } = (request.data || {}) as { reference?: string };
  if (!reference) {
    throw new HttpsError("invalid-argument", "Missing payment reference.");
  }

  const txDoc = await db.collection(COL.transactions).doc(reference).get();
  if (!txDoc.exists || txDoc.data()!.userId !== request.auth.uid) {
    throw new HttpsError("not-found", "Payment not found.");
  }

  const tx = txDoc.data()!;
  if (tx.status === "completed" || tx.status === "failed") {
    return { status: tx.status, failureReason: tx.failureReason || null };
  }

  // Ask Marz Pay directly, in case the callback never arrived.
  try {
    const authHeader = marzPayAuthHeader(MARZPAY_API_KEY.value());
    const response = await fetch(
      `${MARZPAY_BASE_URL}/transactions/${encodeURIComponent(reference)}`,
      { headers: { Authorization: authHeader, Accept: "application/json" } }
    );
    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      const fields = extractWebhookFields(result);
      if (isSuccessStatus(fields.providerStatus, fields.eventType)) {
        await activateSubscription(reference);
        return { status: "completed", failureReason: null };
      }
      if (isFailureStatus(fields.providerStatus, fields.eventType)) {
        const reason =
          fields.failureReason || "The mobile money payment was declined or timed out.";
        await failTransaction(reference, reason);
        return { status: "failed", failureReason: sanitizeText(reason) };
      }
    }
  } catch (error) {
    logError("Payment status poll failed", error, { reference });
  }

  // Expire a prompt nobody answered.
  const age = Date.now() - timestampToMillis(tx.createdAt);
  if (age > PROMPT_WINDOW_MS) {
    await failTransaction(reference, "The payment prompt expired. Please try again.");
    return {
      status: "failed",
      failureReason: "The payment prompt expired. Please try again.",
    };
  }

  return { status: "pending", failureReason: null };
});

/* ────────────────────────────────────────────────────────────────
 * tbCancelPayment
 * ──────────────────────────────────────────────────────────────── */
export const tbCancelPayment = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Please sign in first.");
  }
  const uid = request.auth.uid;
  const { reference } = (request.data || {}) as { reference?: string };

  const activeRef = db.collection(COL.activePayments).doc(uid);
  await activeRef.delete().catch(() => undefined);

  if (reference) {
    const txRef = db.collection(COL.transactions).doc(reference);
    const snap = await txRef.get().catch(() => null);
    if (snap && snap.exists && snap.data()?.userId === uid) {
      const currentStatus = snap.data()?.status;
      if (currentStatus === "pending" || currentStatus === "creating") {
        await txRef
          .set(
            {
              status: "failed",
              failureReason: "Cancelled by user.",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
          .catch(() => undefined);
      }
    }
  }

  logInfo("Payment prompt cancelled by user", { uid, reference });
  return { success: true };
});

/* ────────────────────────────────────────────────────────────────
 * Expiry sweep
 * ──────────────────────────────────────────────────────────────── */
export async function expireLapsedSubscriptions(): Promise<number> {
  const now = Date.now();

  // Single-field range filter only. Adding `.where("subscriptionStatus","==",
  // "active")` would make this a composite query needing an index that does
  // not exist on a fresh project — the query would throw, this would abort,
  // and it is the first thing tbBotTick calls. Status is filtered in code.
  const snap = await db
    .collection(COL.users)
    .where("subscriptionExpiresAt", "<=", now)
    .limit(400)
    .get();

  const lapsed = snap.docs.filter((doc) => doc.data().subscriptionStatus === "active");
  if (lapsed.length === 0) return 0;

  const batch = db.batch();
  lapsed.forEach((doc) => {
    batch.set(
      doc.ref,
      {
        subscriptionStatus: "expired",
        botEnabled: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
  await batch.commit();
  logInfo("Expired lapsed subscriptions", { count: lapsed.length });
  return lapsed.length;
}
