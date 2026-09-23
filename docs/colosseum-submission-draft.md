# Colosseum submission draft: Market Scout

## Product

**Market Scout** is a read-only market intelligence surface for Panta prediction markets. It helps builders inspect the live catalog, compare YES/NO prices, identify observable activity, and choose where deeper research is worthwhile before any wallet action.

## What was built during the hackathon

- A new Market Scout tab in the Panta API Playground.
- A live catalog loader using the documented `GET /markets/` endpoint through the existing proxy.
- Transparent signal scoring based on price separation, catalog volume, and market phase.
- Phase and category filters, plus signal, volume, and spread sorting.
- Raw catalog inspection for auditability.
- Explicit read-only and no-custody product copy, with required Powered by Panta attribution.

## Demo path

1. Sign in and create a Panta test API key.
2. Select **Market Scout**.
3. Click **Scan live markets**.
4. Filter to live markets and sort by signal, volume, or spread.

## Technical scope

The feature is implemented in the existing Next.js playground and uses the existing `/api/panta/*` proxy. It does not sign or broadcast Solana transactions. The live endpoint was tested with a test API key; the observed catalog response rendered successfully in the browser.

## Development disclosure

The base repository is the public Panta API Playground. The Market Scout feature and its documentation were added during the Crypto World's Fair development window. The submission should link the final fork/PR and disclose that OpenAI Codex (GPT-6) assisted with implementation.

## Current limitations

The live test catalog currently contains a sandbox market with zero volume, so the board does not claim trading performance or revenue. The feature is intentionally an observability and research surface.
