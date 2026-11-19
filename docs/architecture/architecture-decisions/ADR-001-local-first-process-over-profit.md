# ADR-001: Local-first, process over profit

## Status

Accepted for initial scope.

## Decision

Build the system as a local-only, single-user practice app. All points, levels, virtues, and improvement verdicts are derived from process adherence. Profit and loss are stored for display only and never feed any score.

## Consequences

- Trading data stays on the user's machine.
- A rule-following loss (Good Loss) earns the same as a rule-following win; a rule-breaking profit (Bad Profit) is penalised.
- Leaderboards or profit-based achievements are out of scope.
- Any future cloud or multi-user feature needs a new architecture decision.
