# Specification: grades, quadrants, scorecard, and consequences

## Purpose

Grade each trade on process adherence, classify its outcome, compute the daily Discipline %, and apply the user's own consequence rules.

## Inputs

- Trade plan: entry, stop loss, quantity, risk amount, loss accepted, weapon candle.
- Audit: sl_set, sl_moved, manual_exit (against plan), exit_reason, emotion, lesson, sl_proof.
- Trade result: P&L sign (display and quadrant only).
- Rules from the [ASTA rules catalogue](asta-rules-catalogue.md).

## Rules

### Grade

- **A:** stop loss set in the system, not moved, and no unplanned manual exit, regardless of profit or loss.
- **F:** stop loss not set, moved, or the trade was held hoping for a reversal. A profitable trade can be F.
- A trade without a Trade Gate plan is always F.

### Quadrant

| Grade | Result | Quadrant |
| --- | --- | --- |
| A | Profit | Good Profit |
| A | Loss | Good Loss |
| F | Profit | Bad Profit |
| F | Loss | Bad Loss |

### Discipline % (3:30 PM scorecard)

`Discipline % = Grade-A trades / total trades x 100`, per market day. A day with no trades has no Discipline % and does not affect thresholds or locks.

| Band | Meaning |
| --- | --- |
| 90-100 | Professional |
| 70-89 | Dangerous |
| Below 70 | Red Zone |

### Consequences

- **Red Zone:** Discipline below 70 locks the Trade Gate for the next 2 market days.
- **Capital lock:** any Grade F halves the maximum position size from the next market day. It releases after 3 consecutive market days at 100% discipline (days without trades do not count).
- Locks are stored with start date and release rule and are enforced by the Trade Gate.

## Failure behaviour

- An audit missing a required field is rejected; the trade stays ungraded and is shown as pending on the scorecard.
- An ungraded trade counts as F at 3:30 PM, so skipping audits never improves the score.

## Acceptance criteria

1. Grade and quadrant follow the tables above.
2. Discipline % is computed per market day; no-trade days are excluded.
3. Red Zone and capital locks trigger and release exactly as specified.
4. P&L never changes a grade, Discipline %, or XP.

## Validation scenarios

- A + loss: Good Loss, Discipline 100%.
- Three trades A, A, F (F profitable): 67%, Red Zone, capital lock, Bad Profit.
- After a capital lock: 100%, no-trade day, 100%, 100%: released after the third trading day.
- One ungraded trade at 3:30 PM with one A: 50%, Red Zone.
