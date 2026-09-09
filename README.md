# Panta API Playground

Next.js demo for the Panta Markets API — sign up / log in, mint an API key, run create / buy / claim / trades flows.

Community contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) (fork, PR, and required **Powered by Panta** attribution).

## Tabs

| Tab | What |
| --- | --- |
| **Sign in** | `POST /auth/register/` · `POST /auth/token/` — email/password → JWT |
| **API keys** | `GET\|POST /account/keys/` with Bearer JWT |
| **Account** | `GET /whoami/` · dashboard · metrics · `PATCH /account/` |
| **Markets** | `GET /markets/` · detail · market trades · categories · wallet trades |
| **Create market** | Image upload → quote → build → sign → register (`X-Api-Key`) |
| **Primary buy** | Quote → build → sign → submit/verify (+ optional trade report) |
| **Positions** | `GET /positions/?wallet=` · jump to Claim when claimable |
| **Claim** | Win: `POST /claim/build/` → sign → broadcast → report on Trades · Creator fees: `POST /claim/creator-fees/build/` → sign → broadcast (no trade report) |
| **Trades** | `POST /trades/` · `GET /trades/{signature}/` |
| **Admin** | Metrics, creates, trades, user detail (admin API key) |

Tab panels stay mounted while you switch, so in-progress form/flow state is kept.

## Setup

```bash
cd panta-api-playground
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Variable | Meaning |
| --- | --- |
| `PANTA_API_BASE_URL` | Upstream API, default `http://localhost:8000/api/v1` |
| `NEXT_PUBLIC_DEFAULT_RPC` | Default Solana RPC |

Requests go through `/api/panta/*` (Next proxy). The proxy forwards `Authorization`, `X-Api-Key`, and `X-User-Id`.

## First key

1. **Sign in** tab → register or log in (stores JWT in `localStorage`).
2. **API keys** tab → create a `pk_test_…` key (Bearer auth).
3. Click **Use in connection bar** (or paste the secret), then run product tabs.

Do not commit real secrets. JWT + API key are stored in `localStorage`.

## Attribution

Products and forks that use the Panta API must display **Powered by Panta** where Panta-powered functionality appears. Details: [CONTRIBUTING.md](./CONTRIBUTING.md#attribution--licensing) and the [Terms of Use](https://docs.panta.market/guides/terms-of-use).
