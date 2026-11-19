# Specification: Patience, Discipline, and Focus

## Purpose

Turn the Code of Conduct affirmations into three measurable virtues, scored from observable records rather than self-rating.

## Inputs

- Grades and audits ([scoring-and-grades.md](scoring-and-grades.md)).
- Trade Gate records: plans created, plans abandoned before entry, weapon candle flag.
- Audit exit reason (planned target, planned stop, early book, other).
- Weekly screen-time band and per-trade emotion tag.
- The Code of Conduct mapping in [code-of-conduct.md](../knowledge-base/code-of-conduct.md).

## Rules

All scores are 0 to 100 per market day; weekly values are averages over market days with data.

| Virtue | Signals | Score |
| --- | --- | --- |
| Discipline | Grade A rate; risk within band; audit filed same day | Discipline % (scorecard) |
| Patience | Weapon candle present at entry; trades held to planned exit; early books (Bad Profit); trades above the planned count | 100 x (held-to-plan trades with weapon candle) / total trades, minus 10 per early book and per trade above plan, floored at 0 |
| Focus | Screen-time band; emotion tag; trades without a Gate plan | 100 minus 20 per unplanned trade, minus 10 per non-neutral emotion tag, minus the screen-time penalty (Normal 0, Moderate 5, High 15, Extremely High 30), floored at 0 |

- Lines that train two virtues credit the secondary at half weight in reporting only, not in the score.
- The only self-input kept is the daily oath tap and the free-text lesson; neither changes a score.

## Failure behaviour

A virtue with no data for a day is reported as "no data", never as 0 or 100.

## Acceptance criteria

1. Each virtue is computed only from the listed signals.
2. No-data days are excluded from weekly averages.
3. Profit and loss never affect a virtue.

## Validation scenarios

- Two trades, both held to plan with weapon candle: Patience 100.
- Same, plus one early book: Patience 90.
- One unplanned trade, one fearful tag, screen time High: Focus 55.
- Weekend with no trades: all virtues "no data".

## Open decisions

The penalty values above are initial proposals. Confirm them before E-07 implementation.
