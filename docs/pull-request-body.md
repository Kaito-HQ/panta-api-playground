## What changed

This PR adds a read-only **Market Scout** tab to the Panta API Playground. It loads the documented `GET /markets/` catalog through the existing proxy and turns the response into a small research board with phase and category filters plus signal, volume, and spread sorting.

## Why

The playground already demonstrates transaction flows. Market Scout gives developers a safe way to understand the live catalog before they decide whether to enter a flow that can build or sign a transaction. It never requests a wallet signature, broadcasts a transaction, or takes custody of funds.

## Verification

- `npm run build` passes.
- The changed files pass targeted ESLint checks.
- Manual browser verification against the live Panta API returned a catalog response and rendered the live market table.
- No API key, JWT, wallet private key, or other credential is committed.

## Attribution

The panel displays **Powered by Panta** with a link to `https://panta.market`.

## AI disclosure

This contribution was implemented with assistance from OpenAI Codex (GPT-6).
