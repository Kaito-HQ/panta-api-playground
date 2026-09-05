# Panta API Playground

Next.js demo for the Panta Markets API — no sign-in page. Paste an API key, manage keys, run create/buy flows.

## Tabs

| Tab | What |
| --- | --- |
| **API keys** | `GET/POST /account/keys/`, revoke — create new keys (secret shown once) |
| **Create market** | Quote → build → sign → register |
| **Primary buy** | Quote → build → sign → submit/verify |
| **Admin** | List users / grant create (needs admin key + backend PATCH) |

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

Requests go through `/api/panta/*` (Next proxy).

## First key

Creating keys via the API still requires an existing key (`X-Api-Key`). Issue the first one from `panta-dev` (Django admin / shell), paste it in the top bar, then use the **API keys** tab to mint more.

Do not commit real secrets. The key is stored in `localStorage`.
