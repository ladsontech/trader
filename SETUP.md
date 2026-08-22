# TradeBot — setup and deployment

TradeBot is a React + Firebase app that runs an automated forex strategy on the
user's **own** Exness or FBS MetaTrader 5 account. It shares the `investio-ug`
Firebase project with Investio, and reuses Investio's Marz Pay mobile-money
gateway — but nothing inside the `investio/` folder is modified, and TradeBot
functions are deployed as a **separate Firebase codebase** (`tradebot`).

---

## 1. What changed and why

### The payment bug that was fixed

`Subscribe.tsx` used to call Investio's `initiateDeposit`. That writes a
**deposit** into `pending_transactions`, and Investio's `marzPayWebhook` then runs
`users/{uid}.balance += amount` and pays a 30% first-deposit referral commission.

The effect: every TradeBot subscription credited the payer's Investio wallet with
the full UGX 50,000 / 100,000 back. A user could subscribe and withdraw the same
money.

`Subscribe.tsx` also set `subscriptionStatus: 'active'` from the browser, so
anyone with the developer console could activate themselves for free.

**Now:** TradeBot calls Marz Pay itself (`tbInitiateSubscription`) with its own
`callback_url` pointing at `tbMarzPayWebhook`, and keeps its own ledger in
`tradebot_transactions`. Subscriptions are activated **only** by that webhook,
server-side. Investio's wallet balances and referral rewards are never touched.

### Broker execution is real

Exness and FBS publish no trading API — they are MT4/MT5 brokers. TradeBot uses
[MetaApi](https://metaapi.cloud) as a cloud bridge to MetaTrader 5:

- `tbConnectBroker` provisions an MT5 terminal, waits for the broker to *accept*
  the credentials, and reads the live balance back. Wrong password or wrong
  server name fails loudly instead of showing a fake "Connected" badge.
- `tbGetTrades` reads real open positions and real closed deals.
- `tbBotTick` runs every 15 minutes and places genuine market orders with a stop
  loss and take profit on every one.

---

## 2. One-time configuration

### 2.1 Secrets

Three secrets are needed in Secret Manager, on the `investio-ug` project:

```bash
# Already exists — created for Investio. TradeBot reuses the same value.
firebase functions:secrets:access MARZPAY_API_KEY

# Your MetaApi auth token: https://app.metaapi.cloud → Settings → API tokens
firebase functions:secrets:set METAAPI_TOKEN

# 32-byte key used to encrypt broker passwords at rest.
# Generate one and paste it when prompted:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
firebase functions:secrets:set BROKER_ENC_KEY
```

> `BROKER_ENC_KEY` must never change once users have connected brokers — rotating
> it makes stored passwords undecryptable and every user has to reconnect.

### 2.2 MetaApi account

MetaApi is a paid service (roughly USD 18+/month per connected account, billed
per deployed terminal). Sign up at <https://metaapi.cloud>, create an API token
with provisioning + trading scopes, and put it in `METAAPI_TOKEN` above.

Costs scale with the number of *connected* users, so `tbDisconnectBroker`
undeploys **and deletes** the MetaApi account rather than leaving it running.

### 2.3 VPC connector (Marz Pay egress IP)

`config.ts` reuses Investio's existing connector:

```
projects/investio-ug/locations/us-central1/connectors/marzpay-egress
```

If Marz Pay allowlists your IP, nothing to do. If the connector does not exist,
set `MARZPAY_VPC_CONNECTOR=""` in the functions environment to disable it.

---

## 3. Deploying

### Functions

From the `TradeBot/` folder:

```bash
cd functions && npm install && cd ..
firebase deploy --only functions:tradebot
```

`firebase.json` in this folder declares `"codebase": "tradebot"`, so this command
touches **only** TradeBot's functions. Investio's `default` codebase is left
alone, and deploying Investio does not delete these.

Functions deployed:

| Function | Type | Purpose |
| --- | --- | --- |
| `tbInitiateSubscription` | callable | Sends the mobile-money prompt |
| `tbMarzPayWebhook` | https | Provider callback; the only thing that activates a plan |
| `tbCheckPayment` | callable | Poll fallback if the callback is late |
| `tbConnectBroker` | callable | Provisions + verifies the MT5 connection |
| `tbDisconnectBroker` | callable | Undeploys and deletes the MetaApi account |
| `tbBrokerState` | callable | Live balance / equity / margin |
| `tbGetTrades` | callable | Real positions and deal history |
| `tbClosePosition` | callable | Manual close |
| `tbSetBotEnabled` | callable | User pause switch |
| `tbBotTick` | scheduled | Every 15 min — the actual bot |
| `tbDailyMaintenance` | scheduled | Expires lapsed subscriptions |

After the first deploy, confirm the webhook URL matches what `config.ts`
computes:

```
https://us-central1-investio-ug.cloudfunctions.net/tbMarzPayWebhook
```

If your region differs, set `TRADEBOT_WEBHOOK_URL` in the functions environment.

### Firestore rules

**Rules are project-wide and live in `investio/firestore.rules`.** This folder
deliberately declares no `firestore` key in `firebase.json`, so a TradeBot deploy
can never overwrite Investio's rules.

The `tradebot_*` blocks in that file have **already been updated** — only those
blocks; every Investio rule is byte-for-byte unchanged. A reference copy is in
`firestore.rules.tradebot.txt`. They are not live until you deploy them, from the
`investio` folder:

```bash
cd ../investio
firebase deploy --only firestore:rules
```

Until you do, the old rule stands and any signed-in user can set
`subscriptionStatus: 'active'` on their own document from the browser console.

### Frontend

```bash
npm install
npm run build      # tsc -b && vite build
```

Deploys to Vercel as-is (`vercel.json` already rewrites to `index.html`).

---

## 4. How the app flows

```
sign up ──▶ /welcome ──▶ /subscribe ──▶ /broker ──▶ /  (dashboard)
            4 cards      mobile money    MT5 login
```

`Gate` in `App.tsx` enforces the order for convenience. The real enforcement is
server-side: `tbConnectBroker` refuses without an active subscription, and
`tbBotTick` only picks up users who are `subscriptionStatus == active`,
`brokerConnected == true`, `botEnabled == true` and not past their expiry.

---

## 5. The strategy

`functions/src/strategy.ts` — deliberately simple and auditable.

- **Trend filter:** EMA 21 vs EMA 55 on the 15-minute chart, requiring at least
  0.25 × ATR of separation so it ignores flat markets.
- **Trigger:** RSI(14) pulls back and turns in the direction of the trend.
- **Stop loss:** 1.8 × ATR. **Take profit:** 2.7 × ATR.
- **Size:** derived from account equity, the stop distance and the symbol's tick
  value — never a fixed lot. Below the broker minimum, the trade is skipped.
- **Skips:** spread above 25% of ATR, symbol already held, max positions reached,
  daily realised loss ≥ 5% of equity, market closed (weekends).

Tuning lives in `RISK_LIMITS` and `PLANS` in `functions/src/config.ts`. Prices
there are the source of truth — editing `src/lib/constants.ts` changes only the
display.

---

## 6. Firestore collections

| Collection | Written by | Read by |
| --- | --- | --- |
| `tradebot_users/{uid}` | Cloud Functions (subscription, broker, bot fields); client may only set `onboardedAt` | owner |
| `tradebot_transactions/{reference}` | Cloud Functions | owner (read only) |
| `tradebot_subscriptions/{reference}` | Cloud Functions | owner (read only) |
| `tradebot_broker_connections/{uid}` | Cloud Functions | **nobody** — holds encrypted credentials |
| `tradebot_trades/{auto}` | Cloud Functions | owner (read only) |
| `tradebot_bot_runs/{auto}` | Cloud Functions | admins |

---

## 7. Testing without risking money

Both Exness and FBS issue MT5 **demo** accounts with a real server name and
login. They connect through exactly the same path, so you can run the whole
flow — subscription, connection, live orders — against play money first.

---

## 8. Honest limitations

- MetaApi is a real running cost per connected account. Price the plans with that
  in mind: at UGX 100,000/month you have roughly USD 26 of revenue against
  roughly USD 18 of bridge cost per user.
- The strategy is a mechanical rule set, not a guarantee. It will have losing
  weeks. The daily loss limit contains damage; it does not remove it.
- If MetaApi is unreachable, `tbBotTick` skips that cycle rather than retrying —
  a missed entry is cheaper than a duplicated one.
- Broker passwords are recoverable by design (MetaApi needs them). They are
  AES-256-GCM encrypted with a Secret Manager key and never returned to the
  browser, but this is encryption, not hashing. Treat the project's IAM
  permissions accordingly.
