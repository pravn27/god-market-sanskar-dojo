# Specification: Daily Dojo

## Purpose

Build the daily ASTA rituals into a habit by recording them quickly, showing progress through a mood level, and counting market-day streaks.

## Inputs

- Ritual definitions seeded from `2026/daily rituals _ habits.xlsx` (setup sheet).
- Daily check-ins: ritual id, date, done.
- Market calendar: Monday to Friday, minus holidays listed in `config/market-holidays.yaml`.
- Code of Conduct lines from [code-of-conduct.md](../knowledge-base/code-of-conduct.md).

## Ritual definitions (seed)

| Id | Ritual | Minutes | Cadence |
| --- | --- | --- | --- |
| market_overview | Daily Rituals on Market Overview | 45 | Daily |
| backtesting | Daily Backtesting | 30 | Daily |
| geo_revision | Repeat, learn and clear concepts: Full GEO revision | 15 | Daily |
| webinar | MyASTA webinar recording session | 20 | Daily |
| preparation | Market preparation, execution planning, money management | 10 | Daily |
| buddy_connect | Accountability buddy connect | 15 | Daily |
| opportunity_hunting | Opportunity hunting: Nifty sectors vs stocks | 60 | Weekend (Sat/Sun) |
| log_audit | Trade log update and SWOT review | 60 | Monthly (last 2 market days of the month) |

Daily total: 135 minutes.

## Rules

- **Mood level** by count of daily rituals done: 0 none, 1 Blank, 2 Started, 3 Steady, 4 Strong, 5 Rocket, 6 On fire (the sheet's emoji scale, shown as labels).
- **Streak:** consecutive market days on which at least `streak.min_daily_rituals` daily rituals were done. Non-market days are skipped, never counted as breaks. Today does not break the streak until the day ends.
- **Sanskar line:** one Code of Conduct line per day, rotating in order, the same for the whole day.
- A check-in can be toggled on the same day; past days are read-only.
- Weekend and monthly rituals appear only on their cadence days and never affect the daily streak.
- The monthly review (`log_audit`) appears on the last two market days of each month. Market days are weekdays minus holidays; until a holiday list is configured, weekdays only.

## Failure behaviour

- An unknown ritual id is rejected with a 404 and no record is written.
- A check-in for a future date is rejected.
- If the holiday file is missing, weekdays are treated as market days and the response flags `calendar: weekdays_only`.

## Acceptance criteria

1. Today's view lists the daily rituals with done state, minutes done, and total minutes.
2. Mood level matches the count of done daily rituals.
3. Streak skips weekends and listed holidays.
4. Sanskar line is stable within a day and changes the next day.
5. Past check-ins cannot be edited.

## Validation scenarios

- Done rituals Mon 4, Tue 5, Wed 2: streak after Wednesday ends is 0; after Tuesday was 2.
- Friday 4 done, weekend nothing, Monday 4 done: streak 2.
- Holiday on Tuesday between two qualifying days: streak continues.
- Toggle a ritual twice on the same day: ends undone, one record.
