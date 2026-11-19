# Implementation Plan: Frontend first slice (shell + Daily Dojo)

## Overview

Build the local React app before the backend. The first slice delivers the application shell with navigation for every planned screen and a working Daily Dojo page that follows [daily-dojo.md](../docs/specifications/daily-dojo.md). Data is stored in the browser behind an API client interface so the backend can replace it later without changing pages.

## Architecture decisions

- Same stack and layout as `god-market-tech-analysis/frontend`: React, TypeScript, Vite, Ant Design, TanStack Query, React Router, zustand, vitest, eslint.
- `src/domain/` holds pure, tested rule functions (mood level, market day, streak, sanskar line). Pages never compute rules inline.
- `src/api/client.ts` defines the `DojoApi` contract. `src/api/localApi.ts` implements it on `localStorage`. A later HTTP implementation will target `/api/v1` through the Vite proxy.
- Market calendar is weekdays only until a holiday list exists; the page states this, as the specification requires.
- Weekend ritual (opportunity hunting) appears on Saturday and Sunday. The monthly ritual moves to the Monthly Boss epic (E-09).

## Dependency graph

```text
Scaffold + shell
   ├── Domain rules (pure functions + tests)
   │      └── Local API client (localStorage) + query hooks
   │             └── Daily Dojo page
   └── Named routes for later screens
```

## Task list

### Phase 1: Foundation

- [x] Task 1: Scaffold the frontend and app shell with routes for Dashboard, Daily Dojo, Readiness, Trade Gate, Audit, Weekly Arena, Monthly Boss, and Character.

### Checkpoint: foundation

- [x] `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` pass.

### Phase 2: Daily Dojo vertical slice

- [x] Task 2: Implement Daily Dojo domain rules with the specification's validation scenarios as tests.
- [x] Task 3: Implement the local API client and query hooks.
- [x] Task 4: Build the Daily Dojo page.

### Checkpoint: Daily Dojo

- [x] All checks pass.
- [ ] Human reviews the page before the next screen is started.
