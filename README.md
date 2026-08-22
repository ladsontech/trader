# TradeBot

An automated forex trading bot that runs on the user's **own** Exness or FBS
MetaTrader 5 account. Ugandan mobile-money subscriptions, real broker execution,
no custody of anyone's funds.

```
sign up ──▶ onboarding ──▶ pay ──▶ connect broker ──▶ dashboard
```

## Stack

- **Frontend** — React 19, Vite, Tailwind 4, React Router, Firebase Web SDK
- **Backend** — Firebase Cloud Functions v2 (codebase `tradebot`), Firestore
- **Payments** — Marz Pay mobile money, the same gateway Investio uses
- **Execution** — [MetaApi](https://metaapi.cloud) cloud bridge to MT5

Shares the `investio-ug` Firebase project with Investio. TradeBot functions
deploy as a separate codebase, so the two never overwrite each other.

## Quick start

```bash
npm install
npm run dev                 # http://localhost:3001

cd functions && npm install
npm run build
```

Deploy:

```bash
firebase deploy --only functions:tradebot   # never touches Investio's functions
npm run build && vercel --prod              # frontend
```

Full configuration — secrets, MetaApi setup, Firestore rules — is in
[`SETUP.md`](./SETUP.md).

## Layout

```
src/
  App.tsx                     routing + the paywall gate
  index.css                   design tokens and component classes
  components/ui.tsx           Button, Card, Field, Notice, Stat, EmptyState
  components/layout/          app chrome
  lib/api.ts                  typed wrappers for every Cloud Function
  lib/auth-context.tsx        auth + live profile subscription
  lib/constants.ts            plans, brokers, onboarding copy (display only)
  lib/format.ts               money, price, time formatting
  pages/                      Auth, Onboarding, Subscribe, ConnectBroker,
                              Dashboard, Trades, Settings

functions/src/
  config.ts                   secrets, plans, risk limits — source of truth
  payments.ts                 subscription payments + activation webhook
  broker.ts                   MetaApi provisioning and verification
  trading.ts                  live trades, manual close, the scheduled bot loop
  strategy.ts                 EMA/RSI/ATR signal engine + position sizing
  metaapi.ts                  MetaApi REST client
  crypto-vault.ts             AES-256-GCM for broker credentials
  util.ts                     phone, logging, provider payload parsing

preview/                      design harness: renders every screen with mock
                              data, no Firebase needed
```

### Design preview

To work on the UI without signing in:

```bash
npx vite --config vite.preview.config.ts
# then ?screen=auth | onboarding | subscribe | dashboard | trades | broker | settings
```

`node shots.mjs` renders all seven screens at desktop and mobile widths into
`shots/`.

## Security model

The browser cannot grant itself anything.

- Only `tbMarzPayWebhook` can mark a subscription active.
- Only Cloud Functions hold the MetaApi token and the broker password key.
- `tbConnectBroker` refuses without an active subscription.
- `tbBotTick` only trades for users who are subscribed, connected, unpaused and
  not expired.

The Firestore rules that enforce the client half of this are in
`firestore.rules.tradebot.txt` and need to be pasted into
`investio/firestore.rules` — rules are project-wide, so this folder deliberately
does not deploy them.

## Risk

TradeBot places leveraged forex orders. It can lose money. Every position gets a
stop loss and a take profit, position size comes from account equity rather than
a fixed lot, and a 5% daily realised loss halts trading for the day — but none of
that makes losses impossible. Test on an MT5 demo account first.
