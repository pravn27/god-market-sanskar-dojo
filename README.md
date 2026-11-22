# God Market Sanskar Dojo

A discipline game for traders: build ASTA habits, character and daily rituals. Points come only from following the process, never from profit.

## Scope

- Daily Dojo: the ASTA daily rituals, sanskar oath (Code of Conduct), mood level and market-day streaks.
- Readiness gate and Trade Gate: trading unlocks only after preparation and a complete, risk-checked plan.
- Post-trade audit with Grade A/F, outcome quadrants and the 3:30 PM discipline scorecard.
- Consequence engine: Red Zone lock and capital lock taken from the ASTA stop-loss rules.
- Patience, Discipline and Focus scores, weekly and monthly reviews, character levels and the Full GEO skill tree.
- Improvement engine that compares process adherence against your own baseline, week over week.

## Out of scope

- Order placement, automated trading or financial advice.
- Using profit as a score: P&L is shown, but it never earns points.

## Status

Frontend first: the app shell and the Daily Dojo work on browser storage. The backend now has its database foundation: profile `praveen`, versioned ritual definitions, logs, an append-only event log and the trade-gate tables. The frontend still uses browser storage until it is switched to the API. See the [documentation map](docs/README.md) and the [delivery roadmap](docs/product/delivery-roadmap.md).

## Run the backend

The backend is a local FastAPI app on SQLite. It creates `data/sanskar-dojo.sqlite3` on first start, applies the migrations and seeds the profile `praveen` with the eight daily rituals.

```bash
uv sync
uv run pytest                      # backend tests
uv run uvicorn sanskar_dojo_api.app:create_app --factory --host 127.0.0.1 --port 8765
curl http://127.0.0.1:8765/api/v1/profiles/praveen/rituals?as_of=2026-11-22
```

Set `SANSKAR_DOJO_DB` to use another database file. The server binds to `127.0.0.1` only.

## Run the frontend

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
npm test           # unit and page tests
```
