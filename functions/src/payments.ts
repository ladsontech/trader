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
import * as crypto from "crypto";
import { db } from "./firebase";
import {
  COL,
  MARZPAY_API_KEY,
  MARZPAY_BASE_URL,
  PLANS,
  TRADEBOT_WEBHOOK_URL,
  getPlanPrice,
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
  isValidPhone,
  logError,
  logInfo,
  normalizePhone,
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
    const { planId, phoneNumber, country: reqCountry } = (request.data || {}) as {
      planId?: string;
      phoneNumber?: string;
      country?: "UG" | "KE";
    };

    const plan = planId ? PLANS[planId] : undefined;
    if (!plan) {
      throw new HttpsError("invalid-argument", "Choose a valid package.");
    }

    const cleanRawPhone = (phoneNumber || "").replace(/\s+/g, "");
    const isKenya =
      reqCountry === "KE" ||
      cleanRawPhone.startsWith("+254") ||
      cleanRawPhone.replace(/\D/g, "").startsWith("254");
    const targetCountry: "UG" | "KE" = isKenya ? "KE" : "UG";
    const currency = isKenya ? "KES" : "UGX";

    if (!phoneNumber || !isValidPhone(phoneNumber, targetCountry)) {
      throw new HttpsError(
        "invalid-argument",
        isKenya
          ? "Enter a valid Safaricom M-Pesa or Airtel Kenya number, e.g. 0712345678."
          : "Enter a valid MTN or Airtel number, e.g. 0770123456."
      );
    }

    const formattedPhone = formatPhone(phoneNumber, targetCountry);
    const localPhone = normalizePhone(phoneNumber, targetCountry);
    const planPrice = getPlanPrice(plan, targetCountry);

    // Reuse a live prompt instead of spamming the user's handset.
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
          amount: Number(active.amount) || planPrice,
          currency: active.currency || currency,
          message: isKenya
            ? "An M-Pesa prompt is already waiting on your phone. Enter your M-Pesa PIN to finish."
            : "A mobile money prompt is already waiting on your phone. Enter your PIN to finish.",
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
      amount: planPrice,
      currency,
      country: targetCountry,
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
      amount: planPrice,
      currency,
      country: targetCountry,
      status: "creating",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await openingBatch.commit();

    try {
      const authHeader = marzPayAuthHeader(MARZPAY_API_KEY.value());

      const formData = new FormData();
      formData.append("phone_number", formattedPhone);
      formData.append("amount", String(planPrice));
      formData.append("country", targetCountry);
      formData.append("reference", reference);
      formData.append("callback_url", TRADEBOT_WEBHOOK_URL);
      formData.append(
        "description",
        `TradeBot ${plan.name} subscription - ${currency} ${planPrice.toLocaleString()}`
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
      const providerUuid = marzPayTransactionUuid(result);
      const providerReference =
        providerUuid || providerIds.find((id) => id !== reference);

      const pendingBatch = db.batch();
      pendingBatch.set(
        txRef,
        {
          status: "pending",
          ...(providerIds.length ? { providerIds } : {}),
          ...(providerReference ? { providerReference } : {}),
          ...(providerUuid ? { providerUuid } : {}),
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
        amount: planPrice,
        currency,
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
 * Provider verification
 *
 * A callback or a poll is only a HINT. Before a plan is activated we ask
 * Marz Pay ourselves what happened to the collection. Without this, anyone
 * who knows their own payment reference (the browser receives it) could POST
 * a fake "completed" callback to tbMarzPayWebhook and get a free plan.
 * ──────────────────────────────────────────────────────────────── */
type ProviderVerdict = "completed" | "failed" | "pending";

/** MarzPay returns { status: "success", data: { transaction: { uuid, status } } }. */
export function marzPayTransactionUuid(result: unknown): string | undefined {
  const r = result as { data?: { transaction?: { uuid?: unknown } }; transaction?: { uuid?: unknown } };
  const uuid = r?.data?.transaction?.uuid ?? r?.transaction?.uuid;
  return typeof uuid === "string" && uuid.trim() ? uuid.trim() : undefined;
}

/**
 * Reads the TRANSACTION status from a Marz Pay response. The top-level
 * `status: "success"` only means the API call worked — it must never be
 * mistaken for a completed payment.
 */
export function marzPayTransactionStatus(result: unknown): string | undefined {
  const r = (result || {}) as Record<string, any>;
  const root = r.data && typeof r.data === "object" ? r.data : r;
  const candidates = [
    root?.transaction?.status,
    root?.collection?.status,
    r?.transaction?.status,
    r?.collection?.status,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * Optional extra: if webhook signing is enabled in the Marz Pay dashboard and
 * MARZPAY_WEBHOOK_SECRET is set in functions/.env, a correctly signed callback
 * is trusted as-is. X-MarzPay-Signature = "t=<ts>,v1=<hmac_sha256(ts + "." + rawBody)>".
 */
export function validMarzPaySignature(rawBody: Buffer | string | undefined, timestamp?: string, signature?: string): boolean {
  const secret = (process.env.MARZPAY_WEBHOOK_SECRET || "").trim();
  if (!secret || !rawBody || !timestamp || !signature) return false;
  const v1 = /v1=([a-f0-9]+)/.exec(signature)?.[1];
  if (!v1) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${typeof rawBody === "string" ? rawBody : rawBody.toString("utf8")}`)
    .digest("hex");
  return expected.length === v1.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

export async function verifyWithMarzPay(tx: FirebaseFirestore.DocumentData): Promise<ProviderVerdict> {
  const authHeader = marzPayAuthHeader(MARZPAY_API_KEY.value());
  const ids = [tx.providerUuid, tx.providerReference, tx.reference].filter(
    (v, i, a): v is string => typeof v === "string" && !!v && a.indexOf(v) === i
  );
  const paths: string[] = [];
  for (const id of ids) {
    paths.push(`/collect-money/${encodeURIComponent(id)}`, `/transactions/${encodeURIComponent(id)}`);
  }
  for (const path of paths) {
    try {
      const response = await fetch(`${MARZPAY_BASE_URL}${path}`, {
        headers: { Authorization: authHeader, Accept: "application/json" },
      });
      if (!response.ok) continue;
      const result = await response.json().catch(() => ({}));
      const status = marzPayTransactionStatus(result);
      if (!status) continue;
      if (isSuccessStatus(status)) return "completed";
      if (isFailureStatus(status)) return "failed";
      return "pending";
    } catch (error) {
      logError("Marz Pay status lookup failed", error, { path: path.split("/")[1] });
    }
  }
  return "pending";
}

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
        country: tx.country || existing.country || "UG",
        currency: tx.currency || existing.currency || "UGX",
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
      currency: tx.currency || "UGX",
      country: tx.country || "UG",
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

      const claimsSuccess = isSuccessStatus(fields.providerStatus, fields.eventType);
      const claimsFailure = isFailureStatus(fields.providerStatus, fields.eventType);
      if (!claimsSuccess && !claimsFailure) {
        res.status(200).send("Pending");
        return;
      }

      // Never trust the callback body on its own — confirm with Marz Pay,
      // unless it carries a valid signature from our webhook secret.
      const signed = validMarzPaySignature(
        (req as unknown as { rawBody?: Buffer }).rawBody,
        req.get("x-marzpay-timestamp") || undefined,
        req.get("x-marzpay-signature") || undefined
      );
      const verdict: ProviderVerdict = signed
        ? claimsSuccess
          ? "completed"
          : "failed"
        : await verifyWithMarzPay(data);
      if (verdict === "completed") {
        await activateSubscription(canonicalReference);
        res.status(200).send("Completed");
        return;
      }
      if (verdict === "failed") {
        await failTransaction(
          canonicalReference,
          fields.failureReason || "The mobile money payment was declined or timed out."
        );
        res.status(200).send("Failed");
        return;
      }
      if (claimsSuccess) {
        logInfo("Webhook claimed success but Marz Pay does not confirm it yet", {
          reference: canonicalReference,
        });
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
    const verdict = await verifyWithMarzPay(tx);
    if (verdict === "completed") {
      await activateSubscription(reference);
      return { status: "completed", failureReason: null };
    }
    if (verdict === "failed") {
      const reason = "The mobile money payment was declined or timed out.";
      await failTransaction(reference, reason);
      return { status: "failed", failureReason: reason };
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
