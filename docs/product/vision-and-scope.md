# Product vision and scope

## Vision

God Market Sanskar Dojo is a local, single-user practice app that turns the ASTA trading process into a daily game. It builds the habits, character, and rituals of a professional trader by rewarding only process adherence: preparation, planned entries, respected stop losses, honest audits, and regular review.

## User outcome

Each day the user can quickly answer:

1. Have I completed my rituals and am I ready to trade today?
2. Did every trade follow a complete, risk-checked plan?
3. Did I respect my stop loss and the ASTA rules (Grade A or F)?
4. Are my Patience, Discipline, and Focus improving week over week?
5. What is my next action?

## In scope

- Local browser app served on the same machine (macOS first; Windows-compatible paths).
- Daily Dojo: the ASTA daily rituals, the Code of Conduct as a daily oath, mood level, and market-day streaks.
- Readiness gate that unlocks the Trade Gate only after preparation.
- Trade Gate with position sizing and risk-band enforcement.
- Post-trade audit, Grade A/F, outcome quadrants, and the 3:30 PM discipline scorecard.
- Consequence engine: Red Zone lock and capital lock.
- Patience, Discipline, and Focus scores; Weekly Arena; Monthly Boss; character levels; Full GEO skill tree.
- Improvement engine comparing process metrics against the user's own baseline.
- Import of the existing sanskar journal spreadsheets and export back to Excel.

## Out of scope

- Order placement, automated or semi-automated trading.
- Live broker verification in v1 (deferred; see [ADR-002](../architecture/architecture-decisions/ADR-002-broker-verification-deferred.md)).
- A hosted, public, or multi-user service.
- Financial advice or trade recommendations.
- Leaderboards or any score derived from profit.

## Product principles

- Process over profit: P&L is shown small and never earns points.
- A Grade A loss scores the same as a Grade A win; a rule-breaking profit is a Grade F.
- Rules are transparent, versioned, and traceable to the ASTA rules catalogue.
- Logging must be fast; an audit should take under two minutes.
- Consequences come from the user's own written rules, not invented penalties.
- Streaks count market days only; holidays and weekends never break them.
