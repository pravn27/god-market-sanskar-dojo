# ADR-002: Broker verification deferred

## Status

Accepted for v1.

## Context

Self-reported stop-loss grading can be gamed. A read-only broker check (Shoonya or OpenAlgo) could confirm that a stop-loss order existed and was not moved. It also adds credentials, session handling, and an external dependency.

## Decision

v1 grades trades from the user's audit plus a manual stop-loss proof field (order id or screenshot reference). Read-only broker verification is epic E-14 and needs its own decision before it is planned.

## Consequences

- v1 has no broker credentials and no network dependency.
- Grades are self-reported; the audit form keeps proof explicit to reduce self-flattery.
- The scoring rules do not change when E-14 is added; a verified source only replaces the manual proof.
