# Specification: improvement engine

## Purpose

Decide whether the user's ASTA journey is improving week by week, using process metrics against the user's own baseline, never profit.

## Inputs

Weekly values for: Discipline %, Patience, Focus, Grade-F count, and the standard deviation of daily Discipline %.

## Rules

1. **Baseline:** the first full week with at least 3 trading days is the personal baseline.
2. **Smoothing:** compare the 4-week moving average with the previous 4-week moving average.
3. **Verdict per dimension:**
   - Improving: moving average better by at least 2 points (for Grade-F count, lower by at least 0.5).
   - Slipping: worse by the same margin.
   - Steady: otherwise.
4. **Consistency:** falling standard deviation of daily Discipline % over 4 weeks is labelled "Stabilising".
5. **Overall:** Improving when Discipline is Improving and no other dimension is Slipping.
6. Fewer than 4 weeks of data: verdict is "Building baseline".

## Failure behaviour

Weeks without trades are skipped in moving averages; the response states how many weeks were used.

## Acceptance criteria

1. Verdicts follow the margins above.
2. Profit and loss are never inputs.
3. Fewer than 4 weeks returns "Building baseline".

## Validation scenarios

- Discipline weekly 62, 70, 74, 83, 88, 92: Improving.
- Discipline flat at 85 for 8 weeks: Steady.
- Grade-F counts 1, 1, 2, 3, 3, 4: Slipping.
- Three weeks of data: Building baseline.
