# Frontend first slice — task checklist

## Task 1: Scaffold and app shell

**Description:** Create the Vite React TypeScript app with the reference project's providers, theme, UI store, test setup, and lint configuration. Add a shell with primary navigation and named routes for every planned screen.

**Acceptance criteria:**

- [x] The app starts with `npm run dev` and opens the Daily Dojo by default.
- [x] Navigation lists all eight screens; screens not yet built state which epic delivers them.
- [x] Light and dark themes toggle and persist.

**Verification:**

- [x] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`

**Dependencies:** None

**Files likely touched:** `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/{main,App,AppProviders,theme}.tsx`, `frontend/src/state/uiStore.ts`, `frontend/src/test/setup.ts`

**Estimated scope:** Medium

## Task 2: Daily Dojo domain rules

**Description:** Pure functions for ritual definitions, mood level, market day, streak, and the daily sanskar line.

**Acceptance criteria:**

- [x] Mood level matches the count of done daily rituals (0 to 6).
- [x] Streak counts consecutive market days with at least 4 daily rituals; weekends are skipped; today does not break the streak.
- [x] Sanskar line is stable for a day and rotates through the 22 Code of Conduct lines.

**Verification:**

- [x] Tests cover the specification's validation scenarios: `npm test -- src/domain`

**Dependencies:** Task 1

**Files likely touched:** `frontend/src/domain/*.ts`, `frontend/src/domain/*.test.ts`

**Estimated scope:** Small

## Task 3: Local API client and hooks

**Description:** Define the `DojoApi` contract and implement it on `localStorage`; add TanStack Query hooks.

**Acceptance criteria:**

- [x] Toggling a ritual today persists across reloads.
- [x] Past and future dates are rejected.
- [x] Unknown ritual ids are rejected.

**Verification:**

- [x] `npm test -- src/api`

**Dependencies:** Task 2

**Files likely touched:** `frontend/src/api/client.ts`, `frontend/src/api/localApi.ts`, `frontend/src/features/daily-dojo/useDailyDojo.ts`

**Estimated scope:** Small

## Task 4: Daily Dojo page

**Description:** Today view with sanskar line, ritual checklist, minutes progress, mood level, and streak.

**Acceptance criteria:**

- [x] Ticking a ritual updates mood level, minutes, and progress immediately.
- [x] Streak and calendar note (weekdays only) are visible.
- [x] Weekend ritual appears only on Saturday and Sunday.

**Verification:**

- [x] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`

**Dependencies:** Task 3

**Files likely touched:** `frontend/src/features/daily-dojo/*`

**Estimated scope:** Medium
