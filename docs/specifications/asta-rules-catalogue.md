# Specification: ASTA rules catalogue

## Purpose

Define every threshold, lock, and limit used by the app in one versioned place, so that scoring is transparent and every rule traces to the user's ASTA journal.

## Inputs

A single file `config/asta-rules.yaml`, loaded and validated at backend start.

## Contract

```yaml
version: 1
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
```

## Rules

- The backend refuses to start if the file is missing, malformed, or fails validation; the error names the field.
- Every computed record stores the `version` it used.
- Changing a value requires bumping `version`; past records are never recomputed silently.
- Values marked as defaults may be overridden per week by the Weekly Arena focus (capital, brick size, risk band).

## Sources

| Rule | Source |
| --- | --- |
| Priorities | `knowledge source/Process.png` |
| Discipline thresholds, Red Zone, capital lock | "how to take Stop loss" sheet in `2026/daily rituals _ habits.xlsx` |
| Risk defaults | `2026/weekly.xlsx` focus sheet |
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

- Load the example file: succeeds, version 1.
- Remove `discipline.dangerous_min_pct`: startup fails naming that field.
- Set `readiness.weights` that do not sum to 100: startup fails.
