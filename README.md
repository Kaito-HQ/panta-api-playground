# Panta API Playground

Next.js demo app for screen-sharing the Panta Markets API: **quote → build → wallet sign → broadcast → register/submit**.

Quotes and raw JSON responses are shown beside each step so engineers can see exactly what the API returns.

## Prerequisites

1. **panta-dev** running locally (or a staging host), with Redis + DB migrated  
2. A test API key (`pk_test_…`) with `canCreateMarkets` if you demo create  
3. A Solana wallet (Phantom / Solflare) funded on the cluster your RPC uses  
4. For create: a public **1024×1024** `imageUrl` the API can fetch  

## Setup

```bash
cd panta-api-playground
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Env

| Variable | Meaning |
| --- | --- |
| `PANTA_API_BASE_URL` | Upstream API root, default `http://localhost:8000/api/v1` |
| `NEXT_PUBLIC_DEFAULT_RPC` | Default Solana RPC shown in the UI |

The browser talks to **this app’s** `/api/panta/*` proxy (no CORS setup on Django required for local demos). The proxy forwards `X-Api-Key` to `PANTA_API_BASE_URL`.

If you call the API from another origin without the proxy, add that origin to panta-dev `CORS_ALLOWED_ORIGINS`.

## Demo flow (create market)

1. Paste API key → **Test key**  
2. **Connect wallet**  
3. Fill market fields + `imageUrl`  
4. **Quote** — fee + `createId` appear in the callout and JSON panel  
5. **Build** — unsigned versioned tx  
6. **Sign & broadcast** — wallet popup, then signature  
7. **Register** — `marketId` + `registered`  

Then switch to **Primary buy**, paste `marketId`, quote a YES/NO size, build, sign, submit/verify.

## Notes

- Create build returns a full base64 `VersionedTransaction`.  
- Primary buy build returns **instructions**; the playground compiles them client-side.  
- Do not commit real API keys. Keys are stored in `localStorage` only.
