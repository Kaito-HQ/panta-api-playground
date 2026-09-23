# Market Scout

Market Scout is a read-only research surface for Panta prediction markets. A researcher can load the live catalog, filter it to active phases, and sort opportunities by a transparent signal that combines:

- YES/NO price separation;
- observed catalog volume; and
- whether the market is currently in a tradable primary or secondary phase.

The product uses the documented `GET /markets/` route through the existing `/api/panta/*` proxy. It does not request a wallet signature, broadcast a transaction, or custody funds. Users can inspect the raw catalog response when they need to verify the calculation.

## Demo flow

1. Add a Panta `pk_test_…` key in the connection bar.
2. Open **Market Scout**.
3. Click **Scan live markets**.
4. Sort by signal, volume, or spread and filter by phase/category.

The page displays **Powered by Panta** beside the method description, as required by the public API terms.
