# Backtest log: build plan

Spec: `docs/specifications/backtest-log.md`.

## Order

1. **Backend storage and rules** (this step). Migration 2, the rules module, the request model, and the API. Tests first for the rules and the routes.
2. **Frontend API contract.** Add the backtest types and methods to `DojoApi`, implement them in `httpApi`, and return "needs the local backend" from `localApi`.
3. **Page and drawer.** The `/backtests` route, the side-menu entry, the list with filters, and the New backtest drawer. Segment-specific fields, a live summary, and the save errors shown inline.
4. **Trade Gate handoff.** Log plan opens the drawer with the plan's values prefilled. Plan values are not stored as a link.
5. **Verification.** Backend tests, `pytest`; frontend `npm run test`, `typecheck`, `lint`, `build`; then a browser check.

## Step 1 checklist

- [x] Migration 2 creates `backtest_logs` and `backtest_log_checks`, with CHECK rules for segment and side
- [x] `backtests.py`: calculated fields, `RR_BASIS`, `RULES_VERSION`, repository functions
- [x] `models.py`: `BacktestFields` with the validation rules in the spec
- [x] `app.py`: list, create, get, update and delete routes
- [x] `tests/test_backtest_rules.py`: calculations and each validation rule
- [x] `tests/test_backtests_api.py`: routes, filters, 404s, and the migration to version 2
- [x] `tests/test_store.py` and `tests/test_api.py`: schema version moves from 1 to 2
- [x] Full `pytest` run passes

## Steps 2 to 4 checklist

- [x] `DojoApi` backtest methods and types; `httpApi` mapping (snake_case to camelCase); `localApi` returns "needs the local backend"
- [x] `TradePlan.optionType` carried from Trade Gate into browser storage
- [x] `features/backtests/`: list with filters and totals, detail drawer, New and Edit drawer, live summary and blocking reasons
- [x] `/backtests` route and "Backtesting" menu entry (epic label "No epic yet")
- [x] Trade Gate Log plan opens the drawer with the plan's values prefilled
- [x] Tests: domain rules, HTTP mapping, page (create, edit, prefill from plan); Trade Gate test updated for the handoff
- [x] `npm run test` (140 pass), `typecheck`, `lint`, `build`

Not yet done: a browser check of the page.

## Open before step 3

- Confirm assumptions 1 to 3 in the spec.
- Checklist items for double top or bottom and 3rd wave (needed before those setups can tick items).
