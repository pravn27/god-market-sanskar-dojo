# Backtest log

A backtest log records one simulated trade so that setups can be practised and reviewed. It covers swing setups (RD bullish and bearish, FBD, double top and bottom) and momentum setups (3rd wave). Trades can be equity, futures or options. Logs are kept in SQLite and are edited and deleted freely.

## Decisions

| Topic | Decision | Source |
| --- | --- | --- |
| Segments | Equity, futures, options. Most trading is F&O | Owner |
| Strike and expiry | Entered on the backtest page, not on Trade Gate | Owner |
| R:R minimum | 1:3 must be met to save. Measured to Target 1 (see assumptions) | Owner chose 1:3 |
| ROC | Dropped. ROI only | Owner |
| Legs | Single-leg only. No legs table | Owner |
| Charges | Deferred. No charges field yet | Owner |
| Name column | Dropped. This log is personal | Assumed; not yet confirmed |
| Entry criteria | Text, required. Written before entry | Owner said yes |
| Exit criteria | Text, optional. The planned exit rule, written before entry | Owner said yes |
| Lesson | Text, required. One line at close | Canvas plan |
| Trade Gate link | Prefill only. No foreign key to `trade_plans` yet | Assumed (see below) |

### Assumptions to confirm

1. **R:R basis is Target 1.** Trade Gate has one target, which maps to `target_1`. `rr_t2` is shown but does not gate saving. Change `RR_BASIS` in `backtests.py` if the basis changes.
2. **Holding days are calendar days**: exit date minus entry date.
3. **Exit reason uses the `trade_exits` vocabulary** from migration 1: `planned_target`, `planned_stop`, `trail_stop`, `view_invalidated`, `early_book`, `other`.
4. **No `plan_id` in this version.** Trade Gate plans are still in browser storage, so a foreign key would have no row to point to. A later migration adds `plan_id` when plans are saved on the backend.

## Fields

### Stored (typed in)

| Column | Type | Rule |
| --- | --- | --- |
| `segment` | enum | `equity`, `futures`, `options` |
| `side` | enum | `buy` or `sell` |
| `setup_family` | enum | `swing` or `momentum` |
| `setup_type` | enum | `rd_bullish`, `rd_bearish`, `fbd`, `double_top`, `double_bottom`, `third_wave`, `other` |
| `pattern` | text, optional | For example Morning star, H&S |
| `instrument` | text | Required, 1 to 40 characters |
| `option_type` | enum | `CE` or `PE`. Options only |
| `strike` | number > 0 | Options only |
| `expiry_date` | date | Futures and options |
| `lot_size` | integer > 0 | Futures and options |
| `lots` | integer > 0 | Futures and options |
| `quantity` | integer > 0 | Equity: shares entered. F&O: stored as `lots x lot_size` |
| `tide_tf`, `wave_tf`, `ripple_tf` | enum, optional | `5min`, `15min`, `30min`, `1hr`, `4hr`, `daily`, `weekly`, `monthly` |
| `entry_date` | date | Required |
| `entry_time` | `HH:MM`, optional | 24-hour clock |
| `entry_price` | number > 0 | Premium for options |
| `entry_criteria` | text | Required, not blank |
| `stop_loss` | number > 0 | Premium for options |
| `target_1` | number > 0 | Required |
| `target_2` | number > 0, optional | Must lie beyond `target_1` in the trade's direction |
| `exit_date` | date | Required. Not before `entry_date` |
| `exit_time` | `HH:MM`, optional | Must not be earlier than `entry_time` when both are on the same day |
| `exit_price` | number > 0 | Premium for options |
| `exit_reason` | enum | See assumption 3. Required |
| `exit_criteria` | text, optional | Planned exit rule |
| `capital` | number > 0 | Snapshot of the capital at the time of the trade. Required |
| `spot_price` | number > 0, optional | Options: underlying at entry |
| `margin_used` | number > 0, optional | From the broker. Not calculated |
| `observations` | text, optional | Free notes, including the TA summary |
| `chart_link` | URL, optional | TradingView or GoCharting |
| `lesson` | text | Required, not blank |

Checklist ticks are stored in `backtest_log_checks` (`log_id`, `item_id`, `ticked`). Item lists are not validated yet, because the checklists for double top or bottom and 3rd wave are not defined. See the open items.

### Calculated (returned, never stored)

| Field | Formula |
| --- | --- |
| `risk_per_unit` | `abs(entry_price - stop_loss)` |
| `risk_taken` | `risk_per_unit x quantity` |
| `reward_t1`, `reward_t2` | `(target - entry_price)` signed for the side |
| `rr_t1`, `rr_t2` | `reward / risk_per_unit` |
| `points` | `(exit_price - entry_price)` signed for the side |
| `pnl` | `points x quantity` |
| `pct` | `points / entry_price x 100` |
| `roi` | `pnl / capital x 100` |
| `holding_days` | `(exit_date - entry_date).days` |
| `pnl_category` | `win` when `pnl > 0`, `loss` when `pnl < 0`, otherwise `breakeven` |

`signed for the side`: a buy uses `price - entry`, and a sell uses `entry - price`.

## Validation

Checked by the request model. A failure returns 422 with a message.

1. Futures and options need `lot_size`, `lots` and `expiry_date`. Equity needs `quantity`, and must not have `lot_size`, `lots`, `expiry_date`, `option_type` or `strike`.
2. Options need `option_type` and `strike`. Futures must not have `option_type` or `strike`.
3. Buy: `stop_loss < entry_price < target_1`. Sell: `stop_loss > entry_price > target_1`.
4. `target_2`, when given, is beyond `target_1` in the trade's direction.
5. `risk_per_unit > 0` (already guaranteed by rule 3).
6. `rr_t1 >= 3` (the 1:3 minimum).
7. `exit_date >= entry_date`. When both dates are the same and both times are given, `exit_time >= entry_time`.
8. Times match `HH:MM`. Enums hold only the listed values. Text fields are trimmed; required text is not blank.

## API

Base path: `/api/v1/profiles/{slug}/backtests`

| Method | Path | Result |
| --- | --- | --- |
| GET | `/backtests?segment=&setup_type=&outcome=&from=&to=` | List, newest entry first, with calculated fields |
| POST | `/backtests` | 201, the saved log with calculated fields |
| GET | `/backtests/{id}` | One log |
| PUT | `/backtests/{id}` | Replaces the stored fields and the checks, then returns the log |
| DELETE | `/backtests/{id}` | Deletes the log and its checks |

Unknown profile or id: 404. Invalid body: 422.

The check list in the body is `checks: [{item_id, ticked}]`, at most 60 entries.

## Storage

Migration 2 (`V2_BACKTEST_LOGS`) creates `backtest_logs` and `backtest_log_checks`. It is appended to `MIGRATIONS`; migration 1 is not edited. Segment rules are enforced with CHECK constraints, as `trade_plans` does.

## Frontend

Built: `features/backtests/` (list, detail, New and Edit drawers, `BacktestForm`), route `/backtests`, and the Trade Gate handoff. Menu epic is `No epic yet` until the roadmap has a code for backtesting.


Route `/backtests`, added to the side menu after Trade Gate. The page is a list with filters, a New backtest drawer with segment-specific fields, and a live summary that reuses the calculation rules above. The same drawer opens from Trade Gate's Log plan with the plan's values prefilled. Local browser-storage mode returns the same "needs the local backend" message as History.

## Open items

- Checklist items for double top or bottom and 3rd wave.
- Confirm the three assumptions above.
- Charges field (deferred).
- `plan_id` link once Trade Gate plans are saved on the backend.
