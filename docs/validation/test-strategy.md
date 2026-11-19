# Test strategy

## Test layers

| Layer | Goal | Examples |
| --- | --- | --- |
| Unit | Verify deterministic rules | mood level, streak, grade, quadrant, Discipline %, virtues, verdicts |
| Contract | Verify API and rules file shapes | rules validation errors, request validation, `rules_version` present |
| Integration | Verify component boundaries | check-in → store → today view; audit → scorecard → lock → Trade Gate |
| UI | Verify visible behaviour | Trade Gate disabled when locked, mood label, scorecard bands |
| Replay | Recompute a recorded period | a fixture week produces the expected scores and verdicts |
| Manual | Confirm against the sanskar journal | a known week from the 2026 sheets matches the app |

## Required edge cases

- Weekends, holidays, and days without trades.
- Profitable Grade F trades (Bad Profit).
- Ungraded trades at 3:30 PM.
- Overlapping Red Zone and capital locks.
- A rules version change between two days.
- Fewer than 4 weeks of data for the improvement engine.

## Quality gate

No scoring rule change is complete until its validation scenarios pass as automated tests.
