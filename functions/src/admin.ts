/**
 * Admin data for the /admin screen.
 *
 * Admin access is determined on the server from the caller's Firestore
 * profile (`tradebot_users/{uid}.isAdmin === true` or `role === "admin"`),
 * with optional TRADEBOT_ADMIN_PHONES in functions/.env. No single phone
 * number is hardcoded in the codebase.
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./firebase";
import { COL } from "./config";
import { normalizePhone, timestampToMillis } from "./util";

export function adminPhones(): string[] {
  return (process.env.TRADEBOT_ADMIN_PHONES || "")
    .split(",")
    .map((p) => normalizePhone(p.trim()))
    .filter(Boolean);
}

/** Optional env-configured admin phones ("0753894149@investio.app", etc.). */
export function isAdminEmail(email?: string | null): boolean {
  const phones = adminPhones();
  if (phones.length === 0) return false;
  const prefix = (email || "").split("@")[0] || "";
  const digits = prefix.replace(/\D/g, "");
  if (!digits) return false;
  const local = normalizePhone(digits, digits.startsWith("254") ? "KE" : "UG");
  return phones.includes(local);
}

const ms = (v: unknown) => timestampToMillis(v) || (typeof v === "string" ? Date.parse(v) || 0 : 0);

export const tbAdminData = onCall({ timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Please sign in first.");

  const callerSnap = await db.collection(COL.users).doc(request.auth.uid).get();
  const callerData = callerSnap.exists ? callerSnap.data() : null;
  const callerIsAdmin =
    Boolean(callerData?.isAdmin) ||
    callerData?.role === "admin" ||
    isAdminEmail(request.auth.token.email);

  if (!callerIsAdmin) {
    throw new HttpsError("permission-denied", "This page is for administrators only.");
  }

  const [usersSnap, txSnap] = await Promise.all([
    db.collection(COL.users).limit(2000).get(),
    db.collection(COL.transactions).orderBy("createdAt", "desc").limit(1000).get(),
  ]);

  const users = usersSnap.docs.map((d) => {
    const u = d.data();
    return {
      id: d.id,
      phoneDigits: u.phoneDigits ?? null,
      country: u.country ?? null,
      currency: u.currency ?? null,
      subscriptionPlan: u.subscriptionPlan ?? null,
      subscriptionStatus: u.subscriptionStatus ?? "none",
      subscriptionExpiresAt: Number(u.subscriptionExpiresAt) || null,
      subscriptionActivatedAt: Number(u.subscriptionActivatedAt) || null,
      broker: u.broker ?? null,
      brokerConnected: Boolean(u.brokerConnected),
      brokerAccountId: u.brokerAccountId ?? null,
      brokerServer: u.brokerServer ?? null,
      botEnabled: Boolean(u.botEnabled),
      isAdmin: Boolean(u.isAdmin) || u.role === "admin",
      createdAt: ms(u.createdAt) || null,
    };
  });

  const transactions = txSnap.docs.map((d) => {
    const t = d.data();
    return {
      id: d.id,
      reference: t.reference ?? d.id,
      userId: t.userId ?? null,
      phoneNumber: t.phoneNumber ?? null,
      amount: Number(t.amount) || 0,
      currency: t.currency ?? "UGX",
      planId: t.planId ?? null,
      status: t.status === "creating" ? "pending" : t.status ?? "pending",
      provider: "MarzPay",
      createdAt: ms(t.createdAt) || null,
      completedAt: ms(t.completedAt) || null,
      failureReason: t.failureReason ?? null,
    };
  });

  return { users, transactions };
});
