# Privacy and local data

## Local-first policy

The application stores rituals, plans, trades, audits, reviews, and the XP ledger in a local SQLite file under `data/`, which is excluded from Git. Nothing is sent to an external service in v1.

## Secrets

- v1 needs no credentials.
- Broker credentials (E-14) must never be stored in the repository; they require an approved local secret mechanism and a new architecture decision.
- Do not commit exported spreadsheets or screenshots containing account details.

## Backups

Back up the `data/` folder to keep history. Export to Excel (E-13) provides a portable copy.

## Data retention

All history is kept indefinitely by default, because the improvement engine depends on it. Deleting history must be an explicit user action.
