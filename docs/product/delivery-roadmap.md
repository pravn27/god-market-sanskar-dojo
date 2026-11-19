# Product delivery roadmap

## Reference experience

The design canvases created during planning (blueprint, v2 better option, complete journey, virtues measurement, improvement engine, landing dashboard) are the **presentation reference**. The sibling repository `god-market-tech-analysis` is the **engineering reference**: same stack, documentation style, and delivery workflow.

## Epics, features, and stories

| Epic | Features | First stories | Status |
| --- | --- | --- | --- |
| E-01 Local platform foundation | Project layout, typed API, test harness, frontend shell, startup script | Create the FastAPI service; scaffold the React app; establish tests | Frontend shell done; backend pending |
| E-02 Daily Dojo | Rituals, mood level, market-day streak, sanskar oath | Seed ritual definitions; record a check-in; compute the streak | Frontend slice done on browser storage; backend pending |
| E-03 Readiness gate | Market Overview checklist, readiness score, gate state | Model checklist items; compute the score; unlock at 80 | Backlog |
| E-04 Trade Gate | Plan form, position sizing, risk-band enforcement, loss acceptance | Compute risk; block out-of-band plans; persist a plan | Frontend slice done on browser storage (sizing, R:R, caps, commitment); readiness and locks pending E-03/E-06; backend pending |
| E-05 Audit and scorecard | Audit form, Grade A/F, quadrants, 3:30 PM scorecard | Grade one trade; compute Discipline %; show the scorecard | Backlog |
| E-06 Consequence engine | Red Zone lock, capital lock and release | Trigger a lock; enforce it at the Trade Gate; release after 3 clean days | Backlog |
| E-07 Virtues engine | Patience, Discipline, Focus scores | Compute each virtue from its signals | Backlog |
| E-08 Weekly Arena | Weekly focus, role ratings, screen time, mood | Record a weekly review; roll up daily scores | Backlog |
| E-09 Monthly Boss | Monthly theme, drafted SWOT | Draft SWOT from quadrant counts; record theme outcome | Backlog |
| E-10 Character and XP | Append-only XP ledger, levels, Full GEO skill tree, seasons | Append an XP event; compute level; show skill progress | Backlog |
| E-11 Improvement engine | Baseline, 4-week moving average, variance, verdicts | Compute a weekly verdict per dimension | Backlog |
| E-12 Landing dashboard | Readiness hero, KPIs, rituals, trends, recent trades | Render the dashboard from existing APIs | Backlog |
| E-13 Import and export | Seed from the sanskar journal xlsx, export to Excel | Import one ritual sheet; export daily scores | Backlog |
| E-14 Broker verification | Read-only Shoonya/OpenAlgo stop-loss verification | Deferred by ADR-002 | Deferred |
| E-15 Reminders and packaging | 8 AM and 3:30 PM reminders, local install, recovery | Schedule reminders; document install | Backlog |

## Delivery sequence

`E-01 → E-02 → E-03 → E-04 → E-05 → E-06 → E-07 → E-10 → E-08 → E-09 → E-11 → E-12 → E-13 → E-15`

E-14 needs a new architecture decision before it is planned.

## Next approved planning unit

**Frontend-first:** the shell and the Daily Dojo run on browser storage behind the `DojoApi` contract ([frontend plan](../../tasks/frontend-plan.md)). The next screen is chosen at review. The backend (FastAPI service) follows and replaces the browser storage without changing pages.
