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

Daily Dojo reads and saves through the local backend and its SQLite database: the day view, ticks, the daily count and the streak. Trade Gate still uses browser storage until its endpoints exist. The backend also stores ritual definitions with full history (profile `praveen`) and the event log. See the [documentation map](docs/README.md) and the [delivery roadmap](docs/product/delivery-roadmap.md).

## Start everything

Prerequisites: [uv](https://docs.astral.sh/uv/) and Node.js 24. Then, from the repository root:

```bash
scripts/dev.sh           # installs what is missing, starts backend and frontend
```

Open **http://localhost:5173/rituals**. Press Ctrl-C to stop both. Run all tests with `scripts/dev.sh --test`.

The backend runs on `127.0.0.1:8765` and stores everything in `data/sanskar-dojo.sqlite3`. The full guide covers prerequisites, starting the services by hand, configuration, backups, resetting the database, logs and troubleshooting: [local setup and running](docs/operations/local-setup-and-run.md).
