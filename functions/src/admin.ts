/**
 * Admin data for the /admin screen.
 *
 * Who is an admin is decided HERE, from the caller's verified Firebase sign-in
 * (their phone number), not in the browser. The old screen unlocked with a
 * password that was shipped inside the website's JavaScript, so anyone could
 * read it. Set TRADEBOT_ADMIN_PHONES in functions/.env to change the list
 * (comma separated, e.g. "0753894149,0700000000").
 */
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./firebase";
import { COL } from "./config";
import { normalizePhone, timestampToMillis } from "./util";

const DEFAULT_ADMIN_PHONES = "0753894149";

export function adminPhones(): string[] {
  return (process.env.TRADEBOT_ADMIN_PHONES || DEFAULT_ADMIN_PHONES)
    .split(",")
    .map((p) => normalizePhone(p.trim()))
    .filter(Boolean);
}

/** Sign-in identities look like "0753894149@investio.app" or "254712345678@investio.app". */
export function isAdminEmail(email?: string | null): boolean {
  const prefix = (email || "").split("@")[0] || "";
  const digits = prefix.replace(/\D/g, "");
  if (!digits) return false;
  const local = normalizePhone(digits, digits.startsWith("254") ? "KE" : "UG");
  return adminPhones().includes(local);
}

const ms = (v: unknown) => timestampToMillis(v) || (typeof v === "string" ? Date.parse(v) || 0 : 0);

export const tbAdminData = onCall({ timeoutSeconds: 60 }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Please sign in first.");
  if (!isAdminEmail(request.auth.token.email)) {
    throw new HttpsError("permission-denied", "This page is for TradeBot administrators only.");
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
