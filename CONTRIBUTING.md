# Contributing to Panta API Playground

Community contributions are welcome. This playground shows how partners integrate the Panta Markets API (quote → build → sign → broadcast → register). Improvements that make that path clearer for other developers are especially valuable.

## Before you start

1. **Star** the repo if you find it useful — it helps others discover it.
2. **Fork** [Kaito-HQ/panta-api-playground](https://github.com/Kaito-HQ/panta-api-playground) to your account.
3. Skim the [README](./README.md) and the public docs (how-it-works, authentication, API reference).
4. Read [§ Attribution & licensing](#attribution--licensing) below — required if you ship anything on top of Panta.

## Ways to contribute

- Bug fixes and UX polish in existing flows (create, buy, claim, trades, etc.)
- Clearer error handling and copy that matches API responses
- Docs / README improvements
- New demo panels that exercise documented public endpoints
- Issues describing bugs, gaps, or partner pain points

Please open an issue first for large features or new product surfaces so we can align on scope.

## Development setup

```bash
git clone https://github.com/<your-username>/panta-api-playground.git
cd panta-api-playground
cp .env.example .env.local
npm install
npm run dev
```

Point `PANTA_API_BASE_URL` at a reachable Panta API (local or staging). Never commit `.env.local`, API keys, JWTs, or private keys.

## Pull request process

1. Create a branch from `main`: `git checkout -b fix/short-description`
2. Keep changes focused — one concern per PR when possible
3. Match existing TypeScript / React patterns in `src/`
4. Run `npm run lint` (and exercise the relevant playground tab manually)
5. Push to your fork and open a PR against `Kaito-HQ/panta-api-playground` `main`
6. Describe **what** changed and **why** (link related issues)

Maintainers may ask for small follow-ups before merge.

## Code guidelines

- Prefer the existing proxy path (`/api/panta/*`) over calling the upstream API from the browser with secrets
- Do not hardcode credentials or commit sample keys that look real
- Preserve the custody model: Panta builds unsigned txs; the client signs and broadcasts; then register / report with the signature
- Keep UI copy accurate to the public API docs

## Attribution & licensing

### Contributions to this repository

By submitting a pull request or other contribution, you agree that your contribution may be included in this project under the same terms as the rest of the repository, and that you have the right to submit it.

### “Powered by Panta” (required)

If you fork, extend, or reuse this playground — or build any product, app, widget, or integration that uses the **Panta API** — you must display clear attribution:

**Powered by Panta**

Requirements (aligned with the [Panta Public API Terms of Use](https://docs.panta.market/guides/terms-of-use)):

| Rule | Detail |
| --- | --- |
| Wording | Exactly **“Powered by Panta”** unless Panta approves an alternative in writing |
| Placement | Clear, legible, and reasonably associated with Panta-powered UI (market module, trading screen, footer, etc.) |
| Link | Where hyperlinks work, link to [panta.market](https://panta.market) (or another URL Panta specifies) |
| No obscuring | Do not remove, hide, minimize, or design around the attribution |
| White-label | Omitting or replacing attribution is allowed only under a separate written agreement with Panta |

This applies to forks and demos you publish, partner apps, and any Developer Product that surfaces Panta markets, trading, creation, claims, or related functionality.

### What this repo is not

Contributing here does **not** grant API access by itself. You still need valid Panta credentials and must follow rate limits, security rules, and the Terms of Use.

## Questions

Open a GitHub issue on this repo, or reach out through your Panta partner / developer channel.
