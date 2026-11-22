# Specification: Entry and Exit Rules

## Status

Planning only. No code. Values and rule text are proposed from the ASTA knowledge source and need owner review before the Trade Gate enforces them.

## Purpose

Turn the ASTA setup sheets into explicit entry and exit criteria, so that:

- the Trade Gate can refuse a plan that is missing a required entry check or an exit plan;
- the post-trade audit can record why a trade exited and grade it against the plan.

## Scope

Included:

- Setups: Bullish RD (swing), Double Top, Double Bottom.
- The general entry and exit framework that applies to every setup (SMM seminar key points, "Entry & Exit criteria" and "Trading Steps").

Excluded (later builds): momentum setups, FOME option strategies, intraday setups, the swing versus momentum classifier, and the view-building steps before the setup (covered by the view-building spec).

## Decisions already made

| Decision | Value | Source conflict |
| --- | --- | --- |
| Minimum reward-to-risk | 1:3 | The Bullish RD sheets say "Check RR, min 2.5" and the backtesting template says "mini 2:5". Trading Steps, the SMM sheets and the invest and trade plans say 1:3. Owner chose 1:3 for every setup on 22 Nov 2026. |
| Scope of first build | Bullish RD, Double Top, Double Bottom | Owner choice, 22 Nov 2026. |

## Source map

| Source (under `knowledge source/`) | Sheet | Used for | Quality |
| --- | --- | --- | --- |
| `1- Full GEO series 3G12/setup & its condition/swing setup.xlsx` | Copy of bullish RD, bullish RD | Bullish RD checklist (context, concept, confirmation) | Primary |
| same file | double top | Double Top Yes/No checklist | Primary |
| same file | double bottom | Double Bottom heading only; no answers | Empty |
| `Special Sessions/Full GEO revision & Gromming Sessions/Setups & its conditions.xlsx` | Double Top, Copy of Double Top | Double Top narrative and PAPA and GUE blocks | Primary |
| same file | Double Bottom | Narrative; PAPA and GUE blocks repeat the Double Top text | Needs owner check |
| `1- Full GEO series 3G12/1 - SMM/SMM seminar key points.xlsx` | Entry & Exit criteria, Trading Steps | General entry and exit framework, stop-loss types, targets | Primary, but the exit table columns are mixed in the sheet |
| `Back testing/Copy of Backtesting template.xlsx` | Bullish RD, Bearish RD | Weapon candle must close above or below the 5 EMA ("Imp condition") | Primary |
| `multi-timeframe-analysis.xlsx` | Nifty 50 | Stop-loss check with What If analysis; re-entry only with a new weapon candle | Primary |
| `Color codes.xlsx` | Entry and Exit legend | Labels: RE1 re-entry, RSL1 and RSL2 on weapon candle, TechSL changes the view | Legend only; not read in full |
| `2026/daily rituals _ habits.xlsx` | how to take Stop loss | Discipline thresholds, red zone, capital lock | The sheet holds a pasted AI-generated answer, not an ASTA source. Not used for entry or exit rules. |
| Trade Gate checklist link | Google Sheet "ENTRY, EXIT (SL or Targets) criteria" | Owner's own entry and exit list | Not read. Needs an export. |

## Terms

- **Context (Tide and Wave):** the trend and place in the chart that allow the trade.
- **Concept:** the setup itself, in the Wave timeframe (for example a Bullish RD).
- **Confirmation or weapon:** the candle that triggers the entry, in the Wave timeframe.
- **Weapon candle:** the trigger candle. Its high, low and median are reference levels.
- **Technical SL:** a stop at a structure level (support, resistance, Dow theory swing, trendline).
- **Working SL (my or real SL):** the stop the trader actually places, at a price level tied to the weapon candle. The sheets use "My", "Real" and "Working" SL for the same idea. One term is used in the app: **Working SL**. Owner to confirm.
- **Tide, Wave, Ripple:** the three timeframes. Tide gives direction, Wave is the traded timeframe, Ripple refines the entry and reversals.

## Entry rules

### Common to all three setups

| ID | Rule | Source | Proposed type |
| --- | --- | --- | --- |
| E-C-01 | Trade only in the direction of the Tide (main trend). | Trading Steps 2 | Hard |
| E-C-02 | Decide to buy or sell only after double-screen confirmation. | Trading Steps 1 | Check |
| E-C-03 | Enter only after a weapon candle in the Wave timeframe. No entry in anticipation. | Trading Steps 6, 7, 9 | Hard |
| E-C-04 | Stop loss is within money management, and the R:R is at least 1:3. If the stop is too wide, move the entry. Do not compromise the stop. | Trading Steps 4 | Hard |
| E-C-05 | Find targets (T1, T2, T3) from chart pattern and support or resistance before entry. | Trading Steps 5 | Hard |
| E-C-06 | Refine the entry in the Ripple timeframe. Check the immediate support or resistance. | Trading Steps 11, 12 | Check |
| E-C-07 | Write entry point, stop point, T1, T2, T3, major and immediate levels on the chart, and save it as the reference. | Trading Steps 16 | Check |
| E-C-08 | Staggered entries at Fib 23%, 38%, 50% or 62% are optional. | SMM Entry list 5 | Check |

Hard means the Trade Gate blocks logging when the item is not ticked. Check means the trader must tick it, but it does not block. The Hard or Check split is proposed and needs owner confirmation.

### Bullish RD (long)

Source: `swing setup.xlsx`, Bullish RD sheet.

| ID | Layer | Rule | Proposed type |
| --- | --- | --- | --- |
| E-BRD-01 | Context | Up trend on Tide and Wave. | Hard |
| E-BRD-02 | Context | Price in the upper half of the Bollinger Bands, or near the median. | Check |
| E-BRD-03 | Context | Price near a major support. | Check |
| E-BRD-04 | Concept | Bullish RD: price makes a higher low while the indicator makes a lower low. | Hard |
| E-BRD-05 | Concept | Healthy Fib retracement, at most 50% (23%, 38% or 50%). | Check |
| E-BRD-06 | Concept | Price at significant support: impact line, long EMA (26, 50, 100, 150 or 200), or Fib support. | Check |
| E-BRD-07 | Concept | PAPA BKP, RSI above 40, Stochastic crossover from the oversold zone. | Check |
| E-BRD-08 | Tide | RSI between 40 and 60; above 50 is better. | Check |
| E-BRD-09 | Ripple | Bullish divergence in RSI, or a PAPA or SMM chart pattern. | Check |
| E-BRD-10 | Confirmation | Weapon candle closes above the 5 EMA. | Hard |
| E-BRD-11 | Confirmation | Bullish candlestick pattern; price closes above the 5 and 13 EMA crossover. | Check |
| E-BRD-12 | Confirmation | MACD up-tick, PCO, and moving above the zero line. | Check |
| E-BRD-13 | Options only | OI data analysis (credit strategy, put selling). | Check |

Note: the sheet's step "Check RR, min 2.5" is replaced by E-C-04 (1:3).

### Double Top (short)

Source: `swing setup.xlsx`, double top sheet (Yes/No), and `Setups & its conditions.xlsx`, Double Top.

| ID | Layer | Rule | Proposed type |
| --- | --- | --- | --- |
| E-DT-01 | Price action | Dow theory broken: lower lows and lower highs start, and the up trend has stopped. | Hard |
| E-DT-02 | Price action | Neutral or bearish candle pattern at the previous resistance or the double top. | Check |
| E-DT-03 | Price action | The bullish candle's weapon is taken out by a strong bearish candle. | Hard |
| E-DT-04 | Price action | The close of the strong bearish candle is below the previous bullish candle's open, high, low and close. | Check |
| E-DT-05 | Indicator | Bearish divergence with the BKT. | Check |
| E-DT-06 | Indicator | RSI falls below 60. | Check |
| E-DT-07 | Elliott (GUE) | Bearish divergence between waves 3 and 5, and the end of the 12345 impulse up trend. | Check |
| E-DT-08 | Tide | Wave (Stochastic or RSI) aligned with the Tide. Stochastic sell signal from the overbought zone. | Check |
| E-DT-09 | Ripple | EMAs 5, 13 and 26 in a crossover (NCO) and price below the 50 EMA. | Check |
| E-DT-10 | Entry style | Support trendline breakdown (FBO confirmation), with a shakeout before the breakdown. | Check |

Weapon for the short is E-DT-03. Its exact wording comes from the sheet and needs owner review of the "low of bearish candle" wording.

### Double Bottom (long) (provisional)

Source: `Setups & its conditions.xlsx`, Double Bottom. The swing setup sheet has only a heading.

Mirror of Double Top, taken from the non-copied text. **The PAPA and GUE blocks repeat the Double Top text, so they are excluded until the owner confirms.**

| ID | Layer | Rule | Proposed type |
| --- | --- | --- | --- |
| E-DB-01 | Price action | Dow theory: higher highs and higher lows. | Hard |
| E-DB-02 | Price action | Bullish candle high taken out by a bullish candle, with follow-up and a close above the previous close. | Hard |
| E-DB-03 | Indicator | Bullish divergence (bottom fishing). | Check |
| E-DB-04 | Tide | Wave Stochastic buy signal from the oversold zone, aligned with the Tide. | Check |
| E-DB-05 | Ripple | EMAs 5, 13 and 26 in a crossover (PCO) and price above the 50 EMA. | Check |
| E-DB-06 | Entry style | Resistance trendline breakout, with shakeout before the breakout. The sheet says "breakdown", which looks like a copy error. | Check |

## Exit rules

The SMM seminar sheet says: "DO NOT Exit just because your target is reached. The stock may go up (or down) further!" Exits are either a stop (a loss held to plan) or a target and trail (a gain taken to plan).

### Stop loss

| ID | Rule | Source | Proposed type |
| --- | --- | --- | --- |
| X-SL-01 | A stop is set in the system before entry. Already a Trade Gate commitment. | Daily ritual commitment; Trade Gate spec | Hard |
| X-SL-02 | Technical SL: beyond the immediate support or resistance in Wave, a Dow HL or LH, a support or resistance trendline, or a strong level. | SMM Exit table | Hard for the plan |
| X-SL-03 | Working SL: beyond the weapon candle low (long) or high (short), or the median of a very large breakout or breakdown candle. | SMM Exit table, multi-timeframe Nifty 50 sheet | Hard for the plan |
| X-SL-04 | Exit on a 5, 13 or 26 EMA crossover on the Wave timeframe, used as a working stop. | SMM Exit table | Check |
| X-SL-05 | Stop moves only in the trade's favour: trail, never widen. | SMM Exit header; Trading Steps 14 | Hard |

### Targets and trailing

| ID | Rule | Source | Proposed type |
| --- | --- | --- | --- |
| X-TG-01 | Targets T1, T2 and T3 from chart pattern and support or resistance. | Trading Steps 5 | Hard for the plan |
| X-TG-02 | Partial exit: 50% at T1 or T2. | SMM Exit table (exit at T1 or T2, 50%) | Check |
| X-TG-03 | Partial exit: 33% to 50% when the R:R of 1:3 is reached. | SMM Exit table | Check |
| X-TG-04 | Trail the stop on the 5 EMA (guide) or 13 EMA in the Wave timeframe. Keep the 50 EMA as the technical stop. | Trading Steps 14, 15 | Check |
| X-TG-05 | Trail on significant highs and lows (HL and LH concept). | SMM Exit table | Check |

### View invalidation (exit early for a reason)

| ID | Rule | Source | Proposed type |
| --- | --- | --- | --- |
| X-VI-01 | Wave goes against the Tide. | SMM Exit table | Check |
| X-VI-02 | Divergence on the Wave timeframe. Exit about 33% of the position. | SMM Exit table | Check |
| X-VI-03 | Dow theory violation in Ripple or Wave. | SMM Exit table | Check |
| X-VI-04 | Reversal pattern on the Wave timeframe. | SMM Exit table | Check |
| X-VI-05 | Strong support or resistance at EMA 50, 100 or 200. | SMM Exit table | Check |

### Re-entry

| ID | Rule | Source | Proposed type |
| --- | --- | --- | --- |
| X-RE-01 | After a stop, a re-entry needs a new weapon candle. | multi-timeframe Nifty 50 sheet ("To ReEntries with New Weapon candle"); Color codes "RE1" | Hard |
| X-RE-02 | A re-entry is a new trade plan. It is checked by the Trade Gate again and counts toward the weekly and monthly caps. | Trade Gate caps | Hard |

## Exit reasons (for the audit)

The audit records one reason per exit. The list extends the one in `virtues-measurement.md`:

| Reason | Meaning |
| --- | --- |
| `planned_target` | Exit at T1, T2 or T3 as planned |
| `planned_stop` | Technical or working SL hit |
| `trail_stop` | Trailing SL hit after the trade moved in favour |
| `view_invalidated` | X-VI rule triggered |
| `early_book` | Exited without a plan trigger (counts as a Bad Profit in the Patience score) |
| `other` | Anything else, with a note |

## Failure behaviour (for the later build)

- A plan that leaves a Hard entry item unticked is blocked from logging.
- A plan without a working SL or a target is blocked. This matches the Trade Gate's current SL and target rules.
- Double Bottom is hidden or marked provisional until its PAPA and GUE blocks are confirmed.
- A re-entry without a new weapon candle is blocked.

## Acceptance criteria (for the later build)

1. Each setup shows its checklist with IDs and a source.
2. The Trade Gate blocks logging when a Hard entry item is unticked.
3. Every closed trade has one exit reason from the list.
4. Double Bottom PAPA and GUE items are not shown as active until confirmed.

## Validation scenarios (sheet based)

- Bullish RD long, weapon candle closes above the 5 EMA, R:R 1:3, technical SL: logging allowed.
- Same trade with R:R 2.5: blocked (decision is 1:3).
- Double Top short with no weapon candle: blocked.
- Stopped out, then a re-entry with no new weapon candle: blocked.
- Trade exits on T1 with 50% sold: exit reason `planned_target`.

## UI flow (planning only)

### Where each part lives

| Screen | Path | Use |
| --- | --- | --- |
| Trade Gate | `/trade-gate` | Setup, entry checklist, sizing, exit plan, commitment, save. The main home for these rules. |
| Audit + Scorecard | `/audit` | Records the exit reason for each trade and grades it against the plan. |
| Daily Dojo | `/dojo` | No rule input. At most a read-only link to these rules. |
| Readiness, Dashboard, Character | — | Unchanged by this spec. |

### Trade Gate order, top to bottom

1. **Gate status** (existing): plans this week and month, and any lock.
2. **Setup** (new): choose Bullish RD, Double Top or Double Bottom. Double Bottom shows a "Provisional" tag. The setup sets the default side (Bullish RD long, Double Top short). The trader can change it; a mismatch shows a warning.
3. **Entry checklist** (new card): items for the chosen setup, grouped as in the sections above. Each item has a tick and one badge:
   - **Required**: blocks logging until ticked.
   - **Check**: tick only; does not block.
   - The weapon candle item is always Required.
4. **Risk and position sizing** (existing): capital, conviction, entry, stop, target, and the 1:3 R:R check. The "Use adjusted entry" suggestion stays here.
5. **Exit plan** (new card):
   - Stop type: Technical or Working.
   - Targets T1, T2 and T3, with the partial exit percentage.
   - Trailing rule: 5 EMA or 13 EMA on the Wave timeframe.
   - A reminder: "Do not exit just because the target is reached."
   - A stop and at least one target are required before logging.
6. **Re-entry** (new, shown only after a stopped trade on the same instrument): asks for a new weapon candle. The plan counts toward the weekly and monthly caps.
7. **Commitment** (existing): loss acceptance and the 30-second stop order.
8. **Log plan** (existing): saves the setup, checklist ticks, exit plan and sizing together. It stays disabled until every Required item and the R:R check pass.

### After the trade (Audit, `/audit`)

- The trader selects a logged plan and enters the exit price.
- The trader records one exit reason: `planned_target`, `planned_stop`, `trail_stop`, `view_invalidated`, `early_book`, or `other`.
- Choosing `view_invalidated` shows the X-VI rules to pick from.
- The page grades the trade against the plan.

### Still open for the UI

1. Setup selection on Trade Gate (proposed) or on Readiness.
2. Required items: a red list above the Log plan button, or disabled-button hints only.

## Open questions for the owner

1. Confirm the Hard and Check split for each rule, or change it.
2. Double Bottom: confirm the PAPA and GUE blocks are copy errors, and give the correct text.
3. Confirm "Working SL" as the single term for the stop placed by the trader.
4. Pick one default partial-exit percentage: 50% at T1, or 33% to 50% at 1:3.
5. Share the Google Sheet export for the owner's own entry and exit list, so it can be compared with these rules.
