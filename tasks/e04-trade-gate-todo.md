# Trade Gate first build — task checklist

## Task 1: Domain rules

**Description:** Conviction levels, direction checks, equity and F&O sizing, R:R with 1:3 minimum, adjusted entry, weekly and monthly plan counts.

**Acceptance criteria:**

- [x] Every row of the specification's validation table passes.
- [x] Invalid direction or zero quantity yields a blocking reason.

**Verification:** `npm test -- src/domain/tradeGate`

**Files likely touched:** `frontend/src/domain/tradeGate.ts`, `frontend/src/domain/tradeGate.test.ts`

**Estimated scope:** Small

## Task 2: API status and save

**Description:** `getTradeGateStatus()` and `logTradePlan()` on the `DojoApi` contract and the browser-storage implementation.

**Acceptance criteria:**

- [x] Status reports readiness and locks as not available and the weekly/monthly counts.
- [x] Saves are re-validated; blocked plans and the fourth plan in a week are rejected.

**Verification:** `npm test -- src/api`

**Files likely touched:** `frontend/src/api/client.ts`, `frontend/src/api/localApi.ts`, `frontend/src/api/localApi.test.ts`

**Estimated scope:** Small

## Task 3: Trade Gate page

**Description:** Gate status card, sizing form with live results and the adjusted-entry suggestion, commitment checkboxes, and the Log plan button with the reasons it is disabled.

**Acceptance criteria:**

- [x] Results update as inputs change.
- [x] Log plan is enabled only when sizing is valid, R:R is at least 1:3, both commitments are ticked, and the caps allow it.
- [x] A saved plan shows a confirmation and the weekly count increases.

**Verification:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`

**Files likely touched:** `frontend/src/features/trade-gate/*`, `frontend/src/App.tsx`

**Estimated scope:** Medium
