import { beforeEach, describe, expect, it, vi } from "vitest";
import * as crypto from "crypto";
import { fakeFetch, makeRes } from "./fakes";

const { store } = await vi.hoisted(async () => {
  const { FakeStore } = await import("./fakes");
  return { store: new FakeStore() };
});
vi.mock("../src/firebase", async () => {
  const admin = await import("firebase-admin");
  return { db: store, admin };
});

process.env.MARZPAY_API_KEY = "key:secret";
process.env.METAAPI_TOKEN = "meta-token";

import {
  tbCheckPayment,
  tbInitiateSubscription,
  tbMarzPayWebhook,
  marzPayTransactionStatus,
  validMarzPaySignature,
} from "../src/payments";
import { tbAdminData, isAdminEmail } from "../src/admin";
import { evaluate, resolveSymbols } from "../src/strategy";
import type { Candle } from "../src/metaapi";

const userDoc = (uid: string) => store.docs.get(`tradebot_users/${uid}`);
const auth = (uid: string, email = "0770123456@investio.app") => ({ uid, token: { email } });

function webhookReq(body: unknown, headers: Record<string, string> = {}) {
  const raw = JSON.stringify(body);
  return {
    method: "POST",
    body,
    rawBody: Buffer.from(raw),
    headers,
    get: (h: string) => headers[h.toLowerCase()],
    header: (h: string) => headers[h.toLowerCase()],
  } as any;
}

beforeEach(() => {
  store.docs.clear();
  delete process.env.MARZPAY_WEBHOOK_SECRET;
  vi.unstubAllGlobals();
});

describe("payments", () => {
  async function startPayment(uid = "u1") {
    const f = fakeFetch([
      {
        method: "POST",
        match: "/collect-money",
        status: 201,
        json: { status: "success", data: { transaction: { uuid: "mp-uuid-1", reference: "x", status: "processing" } } },
      },
    ]);
    vi.stubGlobal("fetch", f.fn);
    const res = await (tbInitiateSubscription as any).run({ data: { planId: "standard", phoneNumber: "0770123456", country: "UG" }, auth: auth(uid) });
    return { res, calls: f.calls };
  }

  it("charges the server-side price and remembers Marz Pay's transaction id", async () => {
    const { res, calls } = await startPayment();
    expect(res).toMatchObject({ success: true, amount: 50000, currency: "UGX" });
    expect(calls[0].body).toMatchObject({ amount: "50000", phone_number: "+256770123456", country: "UG" });
    const tx = store.docs.get(`tradebot_transactions/${res.reference}`)!;
    expect(tx.status).toBe("pending");
    expect(tx.providerUuid).toBe("mp-uuid-1");
  });

  it("BLOCKS the free-plan exploit: a forged 'completed' callback does nothing until Marz Pay confirms", async () => {
    const { res } = await startPayment();
    // Marz Pay itself says the collection is still processing
    vi.stubGlobal("fetch", fakeFetch([{ match: "/collect-money/mp-uuid-1", json: { status: "success", data: { transaction: { status: "processing" } } } }]).fn);
    const out = makeRes();
    await (tbMarzPayWebhook as any)(webhookReq({ event_type: "collection.completed", transaction: { reference: res.reference, status: "completed" } }), out);
    expect(out.body).toBe("Pending");
    expect(userDoc("u1")?.subscriptionStatus).toBeUndefined();
  });

  it("activates when Marz Pay confirms the callback", async () => {
    const { res } = await startPayment();
    vi.stubGlobal("fetch", fakeFetch([{ match: "/collect-money/mp-uuid-1", json: { status: "success", data: { transaction: { status: "completed" } } } }]).fn);
    const out = makeRes();
    await (tbMarzPayWebhook as any)(webhookReq({ event_type: "collection.completed", transaction: { reference: res.reference, status: "completed" } }), out);
    expect(out.body).toBe("Completed");
    expect(userDoc("u1")).toMatchObject({ subscriptionStatus: "active", subscriptionPlan: "standard" });
    expect(Number(userDoc("u1")!.subscriptionExpiresAt)).toBeGreaterThan(Date.now() + 360 * 864e5);
  });

  it("trusts a correctly signed callback when webhook signing is enabled", async () => {
    const { res } = await startPayment();
    process.env.MARZPAY_WEBHOOK_SECRET = "whsec_test";
    vi.stubGlobal("fetch", fakeFetch([]).fn); // provider unreachable
    const body = { event_type: "collection.completed", transaction: { reference: res.reference, status: "completed" } };
    const sig = crypto.createHmac("sha256", "whsec_test").update(`123.${JSON.stringify(body)}`).digest("hex");

    const forged = makeRes();
    await (tbMarzPayWebhook as any)(webhookReq(body, { "x-marzpay-timestamp": "123", "x-marzpay-signature": "t=123,v1=deadbeef" }), forged);
    expect(forged.body).toBe("Pending");

    const signed = makeRes();
    await (tbMarzPayWebhook as any)(webhookReq(body, { "x-marzpay-timestamp": "123", "x-marzpay-signature": `t=123,v1=${sig}` }), signed);
    expect(signed.body).toBe("Completed");
    expect(validMarzPaySignature(undefined, "1", "x")).toBe(false);
  });

  it("polling does not mistake the API's top-level 'success' for a paid collection", async () => {
    const { res } = await startPayment();
    vi.stubGlobal("fetch", fakeFetch([{ match: "/collect-money/mp-uuid-1", json: { status: "success", data: { transaction: { status: "processing" } } } }]).fn);
    const pending = await (tbCheckPayment as any).run({ data: { reference: res.reference }, auth: auth("u1") });
    expect(pending.status).toBe("pending");

    vi.stubGlobal("fetch", fakeFetch([{ match: "/collect-money/mp-uuid-1", json: { status: "success", data: { transaction: { status: "completed" } } } }]).fn);
    const done = await (tbCheckPayment as any).run({ data: { reference: res.reference }, auth: auth("u1") });
    expect(done.status).toBe("completed");
    expect(userDoc("u1")?.subscriptionStatus).toBe("active");
  });

  it("another user cannot poll someone else's payment", async () => {
    const { res } = await startPayment();
    await expect((tbCheckPayment as any).run({ data: { reference: res.reference }, auth: auth("u2") })).rejects.toThrow(/not found/i);
  });

  it("reads the nested transaction status", () => {
    expect(marzPayTransactionStatus({ status: "success", data: { transaction: { status: "processing" } } })).toBe("processing");
    expect(marzPayTransactionStatus({ event_type: "x", transaction: { status: "completed" } })).toBe("completed");
    expect(marzPayTransactionStatus({ status: "success" })).toBeUndefined();
  });
});

describe("admin", () => {
  it("only the admin phone gets admin data — no password involved", async () => {
    store.docs.set("tradebot_users/a", { phoneDigits: "0770000001", subscriptionStatus: "active", createdAt: 1 });
    store.docs.set("tradebot_transactions/r1", { userId: "a", amount: 50000, currency: "UGX", status: "completed", createdAt: 5 });
    await expect((tbAdminData as any).run({ data: {}, auth: auth("x", "0770123456@investio.app") })).rejects.toThrow(/administrators only/);
    const ok = await (tbAdminData as any).run({ data: {}, auth: auth("admin", "0753894149@investio.app") });
    expect(ok.users).toHaveLength(1);
    expect(ok.transactions[0]).toMatchObject({ amount: 50000, status: "completed" });
    expect(isAdminEmail("256753894149@investio.app")).toBe(true);
    expect(isAdminEmail(null)).toBe(false);
  });
});

describe("strategy", () => {
  it("maps plan symbols to this account's names (Exness Standard uses an 'm' suffix)", () => {
    expect(resolveSymbols(["EURUSD", "XAUUSD", "GBPJPY"], ["EURUSDm", "XAUUSDm", "EURUSD.ecn"])).toEqual({
      EURUSD: "EURUSDm",
      XAUUSD: "XAUUSDm",
    });
    expect(resolveSymbols(["EURUSD"], ["EURUSD", "EURUSDm"])).toEqual({ EURUSD: "EURUSD" });
  });

  it("is no longer blocked by the candle spread field (points vs price)", () => {
    // Build an uptrend with a pullback, every candle carrying a typical 12-point spread.
    for (let len = 90; len < 400; len++) {
      const candles: Candle[] = Array.from({ length: len }, (_, i) => {
        const c = 1.08 + i * 0.00005 + Math.sin(i / 3) * 0.001;
        return { symbol: "EURUSD", timeframe: "15m", time: String(i), open: c, high: c + 0.0002, low: c - 0.0002, close: c, tickVolume: 1, spread: 12, volume: 1 };
      });
      const signal = evaluate(candles);
      if (signal) {
        expect(["BUY", "SELL"]).toContain(signal.direction);
        return;
      }
    }
    throw new Error("strategy never produced a signal on trending data");
  });
});

describe("MetaApi connect", () => {
  it("keeps asking while MetaApi detects a new broker server (202), then returns the account", async () => {
    const { MetaApiClient } = await import("../src/metaapi");
    let calls = 0;
    const tids = new Set<string>();
    vi.stubGlobal("fetch", async (_url: string, init: any) => {
      calls++;
      tids.add(init.headers["transaction-id"]);
      const accepted = calls < 3;
      return {
        ok: true,
        status: accepted ? 202 : 201,
        text: async () => JSON.stringify(accepted ? { message: "retry later" } : { id: "acc-9", state: "DEPLOYING" }),
      } as any;
    });
    vi.useFakeTimers();
    const promise = new MetaApiClient("t").createAccount({
      name: "n", login: "123456", password: "p", server: "Exness-MT5Trial9", platform: "mt5", keywords: ["Exness"], magic: 1,
    });
    await vi.advanceTimersByTimeAsync(25_000);
    vi.useRealTimers();
    await expect(promise).resolves.toEqual({ id: "acc-9", state: "DEPLOYING" });
    expect(calls).toBe(3);
    expect(tids.size).toBe(1); // same transaction-id every time, as MetaApi requires
  });
});
