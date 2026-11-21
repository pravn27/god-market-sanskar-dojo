# Specification: Trade Gate (first build)

## Purpose

Make risk the first thing calculated for every trade. The Trade Gate sizes the position from capital and conviction, enforces the ASTA reward-to-risk minimum, records the trader's loss commitment, and saves the plan before any order is placed.

## Scope of this build

Included: gate status, risk and position sizing, commitment, saving a plan.
Later builds: view building (setup, screen decision, weapon candle), the full hard-check list, the plans list with Entered/Skipped, readiness and lock enforcement.

## Inputs

| Field | Notes |
| --- | --- |
| Instrument | Free text, for example "Nifty 50" or "NG Mini" |
| Segment | What is traded: `futures`, `options`, or `equity` |
| Side | `buy` (Buy/Long) or `sell` (Sell/Short) of the traded instrument. Buy is long and sell is short for every segment |
| Option type | Options only: `CE` or `PE`, the market view. Required for options. It does not change the side: buying a PE is a buy of the premium (long), and selling an option is short on the premium |
| Capital | Rupees, greater than 0 |
| Conviction | Probability of conviction on TA study (table below) |
| Entry, stop loss, target | Prices or option premium levels, greater than 0 |
| Lot size | F&O only, whole number greater than 0 |

## Rules

Source: `knowledge source/MM Plan & RR calculate/Risk _ Reward Calc.xlsx` and `Invest & Trade Plans/invest & trade plans.xlsx`.

### Conviction levels

| Level | Risk of capital |
| --- | --- |
| Below Low | 0.25% |
| Low | 0.5% |
| Medium | 1% |
| High | 1.5% |
| Above High | 1.75% (keeps a 0.25% buffer under the 2% maximum) |

`Risk allowed = capital x conviction %`. Maximum risk per trade is 2% of capital.

### Risk range

Shown in the risk and sizing card for the entered capital: one row per conviction level with its risk allowed in rupees, plus a Maximum row (2%). The selected conviction row is highlighted. Amounts show "—" when capital is missing. This is a display of the same calculation; it does not change any sizing rule.

### Shares range

Shown in the risk range table, under Risk allowed, as the rows "Shares allowed" and "Investment" for equity, or "Lots allowed" alone for F&O. For each conviction level: `shares = min(floor(risk allowed / risk per share), floor(capital / entry))` and `amount = shares x entry`. It matches the equity quantity in the sizing rule. It stays blank until capital, entry and stop loss are valid.

For F&O: `lots = floor(risk allowed / (risk per unit x lot size))`, the same as the sizing rule with no capital cap. The table shows lots only, with no investment row: the contract value moves with the price, so it is not a fixed figure. Margin is not calculated; the trader checks it with the broker. Lot size must be a whole number before the lots row shows.

### Direction checks

- Long: stop loss < entry < target.
- Short: target < entry < stop loss.

### Sizing

- `Risk per unit = |entry - stop loss|`.
- **Equity:** `quantity = min(floor(risk allowed / risk per unit), floor(capital / entry))`. Investment = quantity x entry.
- **F&O:** `risk per lot = risk per unit x lot size`; `lots = floor(risk allowed / risk per lot)`; quantity = lots x lot size. Margin is not calculated; the trader checks it with the broker.
- `Actual risk = quantity x risk per unit`. It never exceeds the risk allowed.
- A quantity of 0 blocks logging: the stop loss is too wide for the chosen conviction.

### Reward to risk

- `R:R = |target - entry| / |entry - stop loss|`, shown as `1:x`.
- Minimum `1:3`. Below it, logging is blocked and the adjusted entry is suggested ("RR Failure handle" sheet):
  - Long: `stop loss + (target - stop loss) / 4`.
  - Short: `stop loss - (stop loss - target) / 4`.

### Gate status

| Item | This build |
| --- | --- |
| Readiness (E-03) | Shown as "not yet available"; does not block |
| Locks (E-06) | Shown as "not yet available"; does not block |
| Weekly trade cap | 3 saved plans per week (Monday to Sunday); reaching it blocks logging |
| Monthly trade cap | 12 saved plans per calendar month; reaching it blocks logging |

### Commitment

Both must be ticked before logging:

1. "I accept losing ₹{actual risk} on this trade without averaging."
2. "My stop-loss order goes in within 30 seconds of entry."

### Saving

A saved plan stores the inputs, quantity, lots, actual risk, R:R, the date, and the rules version. Saved plans count toward the trade caps.

## Failure behaviour

- Invalid or missing inputs show the reason next to the result; nothing is saved.
- The save is validated again by the API with the same rules; a blocked plan is rejected with the reason.

## Acceptance criteria

1. Sizing matches the worked examples in the risk sheet.
2. R:R below 1:3 blocks logging and shows the adjusted entry.
3. Logging requires both commitments.
4. The fourth plan in a week is rejected.
5. Profit potential never affects any score.

## Validation scenarios

| Case | Inputs | Expected |
| --- | --- | --- |
| Risk range | capital 200,000 | 500; 1,000; 2,000; 3,000; 3,500 (Above High); Maximum 4,000 |
| Shares range | capital 200,000; entry 3,950; SL 3,850 | shares 5; 10; 20; 30; 35; amounts 19,750; 39,500; 79,000; 118,500; 138,250 |
| Shares range, Maximum | same | shares 40 (2% risk); amount 158,000 |
| Equity long, Medium | capital 200,000; entry 3,950; SL 3,850 | risk allowed 2,000; 20 shares; actual risk 2,000; investment 79,000 |
| Equity long, Above High | same | 35 shares (entry limit 50) |
| F&O buy, Medium | capital 300,000; entry 7,780; SL 7,770; lot 250 | risk per lot 2,500; 1 lot |
| F&O buy, Above High | same | 2 lots |
| F&O sell, Low | capital 100,000; entry 5; SL 7; lot 65 | risk per lot 130; 3 lots |
| Adjusted entry, long | SL 232; target 265 | 240.25 |
| Adjusted entry, short | SL 280; target 200 | 260 |
| Weekly cap | 3 plans saved Mon to Wed | fourth rejected |
