# Specification: ASTA rules catalogue

## Purpose

Define every threshold, lock, and limit used by the app in one versioned place, so that scoring is transparent and every rule traces to the user's ASTA journal.

## Inputs

A single file `config/asta-rules.yaml`, loaded and validated at backend start.

## Contract

```yaml
version: 2
priorities:            # Process.png, in order
  - Protect capital
  - Minimise risk
  - Calculate risk before profit
  - Control entry, stop loss, and risk taken
  - Follow only the ASTA process; profit is a by-product
discipline:
  professional_min_pct: 90     # 90-100 Professional
  dangerous_min_pct: 70        # 70-89 Dangerous; below 70 Red Zone
red_zone:
  lock_market_days: 2          # Trade Gate locked; Dojo and backtesting stay open
capital_lock:
  trigger: any_grade_f
  size_factor: 0.5             # next market day maximum position size
  release_clean_days: 3        # consecutive market days at 100% discipline
risk:
  default_capital: 50000
  default_brick_size: 5000
  default_risk_min: 1000
  default_risk_max: 3000
trade_gate:
  max_risk_pct: 2
  conviction_pct: {below_low: 0.25, low: 0.5, medium: 1, high: 1.5, above_high: 1.75}
  min_reward_risk: 3
  weekly_trade_cap: 3
  monthly_trade_cap: 12
readiness:
  unlock_min: 80
  weights: {market_overview: 25, sentiment: 20, bond_risk: 15, plan: 25, calm_check: 15}
bond_risk:
  high_yield_spread_max: 5.5
  move_index_max: 100
streak:
  min_daily_rituals: 4         # of the 6 daily rituals
levels:
  names: [Sadhak, Practitioner, Professional, Master]
  promotion_discipline_min_pct: 90
  promotion_consecutive_weeks: 4
season_default:
  trade_target: 50
  risk_per_trade: 500
  loss_budget: 25000
entry:                          # see entry-and-exit-rules.md; setups under review
  require_weapon_candle: true   # no entry in anticipation
  staggered_entry_fib: [23, 38, 50, 62]
  setups:
    bullish_rd:  {direction: long,  weapon: close_above_ema5, status: active}
    double_top:  {direction: short, weapon: bullish_candle_low_taken_out, status: active}
    double_bottom: {direction: long, weapon: bullish_candle_high_taken_out, status: provisional}  # PAPA and GUE blocks unconfirmed
exit:
  stop_types: [technical, working]
  stop_only_in_favour: true     # trail, never widen
  target_partial_pct: [33, 50]  # share of position exited at target
  trail_ema: 5                  # Wave timeframe guide
  technical_stop_ema: 50
  reentry_requires_new_weapon: true
  reasons: [planned_target, planned_stop, trail_stop, view_invalidated, early_book, other]
```

## Rules

- The backend refuses to start if the file is missing, malformed, or fails validation; the error names the field.
- Every computed record stores the `version` it used.
- Changing a value requires bumping `version`; past records are never recomputed silently.
- Values marked as defaults may be overridden per week by the Weekly Arena focus (capital, brick size, risk band).
- Version history: 1 (initial contract). 2 adds `entry` and `exit` blocks (planning only, see `entry-and-exit-rules.md`). Nothing in version 1 changed.

## Sources

| Rule | Source |
| --- | --- |
| Priorities | `knowledge source/Process.png` |
| Discipline thresholds, Red Zone, capital lock | "how to take Stop loss" sheet in `2026/daily rituals _ habits.xlsx`. This sheet holds a pasted AI-generated answer, not an ASTA source; confirm before relying on it. |
| Entry rules (bullish RD, double top, double bottom) | `1- Full GEO series 3G12/setup & its condition/swing setup.xlsx`; `Special Sessions/Full GEO revision & Gromming Sessions/Setups & its conditions.xlsx`. Double Bottom is provisional. |
| Entry trigger, staggered entries | `1- Full GEO series 3G12/1 - SMM/SMM seminar key points.xlsx` ("Entry & Exit criteria", "Trading Steps") |
| Exit types, targets, trailing, re-entry | `SMM seminar key points.xlsx` ("Entry & Exit criteria"); `multi-timeframe-analysis.xlsx` (Nifty 50) |
| Risk defaults | `2026/weekly.xlsx` focus sheet |
| Trade Gate conviction, 2% maximum, 1:3 minimum | `Risk _ Reward Calc.xlsx` |
| Trade caps (3 a week, 12 a month) | `invest & trade plans.xlsx`, `# trades` sheet |
| Bond-risk thresholds | `Daily Rituals - Market Overview.xlsx` |
| Season default | Satsang challenge sheet |
| Readiness weights, streak minimum, level rules | Proposed in planning; confirm before E-03/E-10 |

## Failure behaviour

Invalid or missing rules stop the backend with a clear message. The app never runs with implicit defaults.

## Acceptance criteria

1. A valid file loads and exposes its version through `/api/v1/rules`.
2. A missing required field produces a validation error naming the field.
3. Records created after a version bump carry the new version.

## Validation scenarios

- Load the example file: succeeds, version 2.
- Remove `discipline.dangerous_min_pct`: startup fails naming that field.
- Set `readiness.weights` that do not sum to 100: startup fails.
