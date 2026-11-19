# ADR-003: FastAPI, React, and SQLite stack

## Status

Accepted.

## Decision

Use the same stack as `god-market-tech-analysis`: Python 3.10+ with uv, FastAPI, and pytest for the backend; React, TypeScript, Vite, Ant Design, TanStack Query, zustand, and vitest for the frontend; SQLite for local storage.

## Consequences

- Shared skills, tooling, and patterns across both God Market repositories, making later integration easier.
- No database server to install; the data file is excluded from Git.
- The rules catalogue is a versioned YAML file read by the backend.
