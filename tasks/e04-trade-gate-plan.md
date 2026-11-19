# Implementation Plan: Trade Gate first build (E-04)

## Overview

Deliver gate status, risk and position sizing, commitment, and plan saving, following [trade-gate.md](../docs/specifications/trade-gate.md). Frontend-first on browser storage behind the `DojoApi` contract.

## Architecture decisions

- Sizing, R:R, adjusted entry, and trade-cap counting are pure functions in `src/domain/tradeGate.ts`. The page and the API use the same functions, so the API re-validates every save.
- Readiness and locks are reported as `not_available` until E-03 and E-06 exist.
- The plan stores the rules version used.

## Dependency graph

```text
Spec + rules catalogue
   └── Domain rules (sizing, R:R, cap) + tests
          └── DojoApi: getTradeGateStatus, logTradePlan + tests
                 └── Trade Gate page + test
```

## Task list

- [x] Task 1: Domain rules with the specification's validation scenarios as tests.
- [x] Task 2: API status and save, with cap and validation tests.
- [x] Task 3: Trade Gate page: status, sizing form and results, commitment, log.

### Checkpoint

- [x] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass.
- [ ] Human reviews the page.
