# Local setup and running

The Sanskar Dojo runs entirely on your machine. Three parts work together:

| Part | Address | What it does |
| --- | --- | --- |
| Database | `data/sanskar-dojo.sqlite3` | SQLite file. Created on the first backend start; holds all history. |
| Backend | `http://127.0.0.1:8765` | FastAPI. Applies migrations, seeds the profile `praveen`, serves `/api/v1`. |
| Frontend | `http://localhost:5173` | Vite dev server. Proxies `/api` to the backend, so the browser only talks to 5173. |

The database has no separate server to install or start. The backend opens the file, so it starts and stops with the backend.

## Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| [uv](https://docs.astral.sh/uv/) | 0.12 or newer | `uv --version` |
| Node.js | 24 (the version the project was last run and tested on) | `node -v` |
| npm | 11 (ships with Node 24) | `npm -v` |
| curl, lsof | Installed on macOS by default | `curl --version`, `lsof -v` |

You do not need to install Python yourself. `uv` downloads Python 3.10 or newer when the project needs it.

On macOS with Homebrew:

```bash
brew install uv node
```

## Start everything

From the repository root:

```bash
scripts/dev.sh
```

The script:

1. Checks that `uv`, `npm` and `curl` are installed.
2. Runs `uv sync` to install or update the Python dependencies.
3. Runs `npm ci` in `frontend/` only if `frontend/node_modules` is missing.
4. Starts the backend on port 8765 and waits until its health check answers.
5. Starts the frontend on port 5173.

When it is ready, open **http://localhost:5173/dojo**.

Stop both services with **Ctrl-C** in the terminal. The script stops the backend when the frontend stops.

If the first run fails, fix the reported problem and run the script again. Each step is safe to repeat.

## Run the tests

```bash
scripts/dev.sh --test
```

This runs the backend tests (pytest), then the frontend tests (Vitest) and the typecheck (`tsc -b`). It does not start any servers. The tests use temporary databases, so your real data is never touched.

## Start the services by hand

Use these when you want to debug one part, or when the script is not suitable.

Backend, in one terminal:

```bash
uv sync
uv run uvicorn sanskar_dojo_api.app:create_app --factory --host 127.0.0.1 --port 8765
```

Frontend, in a second terminal:

```bash
cd frontend
npm ci          # first time only
npm run dev     # http://localhost:5173
```

Check the backend at any time:

```bash
curl http://127.0.0.1:8765/api/v1/health
```

A healthy backend returns `"status":"ok"`, the schema version (currently 1), and the profile `praveen`.

## Configuration

| Setting | Default | How to change |
| --- | --- | --- |
| Database file | `data/sanskar-dojo.sqlite3` in the repository | Set `SANSKAR_DOJO_DB=/path/to/file.sqlite3` before starting |
| Backend port | `8765` (fixed) | Not configurable. The Vite proxy in `frontend/vite.config.ts` points to it. |
| Frontend port | `5173` | Set `SANSKAR_DOJO_WEB_PORT=5199` before running `scripts/dev.sh` |

The backend listens on `127.0.0.1` only, so other machines on your network cannot reach it.

## Database

The database is a single SQLite file in WAL mode. Two extra files, `*-wal` and `*-shm`, appear while the backend runs. They are part of the database; do not delete them while it runs.

**Where it lives.** `data/sanskar-dojo.sqlite3`, excluded from Git.

**Inspect it.**

```bash
sqlite3 data/sanskar-dojo.sqlite3 "SELECT COUNT(*) FROM ritual_logs;"
```

**Back it up.** Use SQLite's own backup so the copy is consistent even while the backend runs:

```bash
sqlite3 data/sanskar-dojo.sqlite3 ".backup 'data/backup-$(date +%Y%m%d).sqlite3'"
```

Copying the file with Finder is safe only when the backend is stopped.

**Reset it.** This deletes all history. Stop the services first, then move the file aside (do not delete it unless you are sure):

```bash
mv data/sanskar-dojo.sqlite3 data/sanskar-dojo.sqlite3.old
```

The next start creates an empty database, applies all migrations and seeds the default rituals again. Deleting history is an explicit user action, as the [privacy and local data policy](privacy-and-local-data.md) requires.

**Schema changes.** Migrations are numbered and append-only. The backend applies any new migration on start, each in its own transaction, and refuses to run against a database that is newer than the code.

## Logs

- **Backend:** `.dev-logs/backend.log` (created by `scripts/dev.sh`, excluded from Git). Read it with `tail -f .dev-logs/backend.log`.
- **Frontend:** printed in the terminal where `scripts/dev.sh` runs.

## Troubleshooting

**"port 8765 is already in use"** or **"port 5173 is already in use"**
Another process holds the port. Find it and stop it:

```bash
lsof -nP -iTCP:8765 -sTCP:LISTEN
```

If it is an old copy of this app, stop it with `kill <pid>`. For the frontend port, you can instead run `SANSKAR_DOJO_WEB_PORT=5199 scripts/dev.sh`.

**"the backend stopped during startup"**
The script prints the last lines of `.dev-logs/backend.log`. Common causes:

- The database file is from a newer version of the app. Update the code, or use a different file with `SANSKAR_DOJO_DB`.
- A migration failed. The log names the migration. The database is rolled back to the previous version, so nothing is half-applied.

**"The Dojo backend is not reachable" in the browser**
The frontend is running but the backend is not. Check the health URL above. If it fails, start the backend or run `scripts/dev.sh` again.

**The page shows a 502 error from Vite**
The backend stopped while the frontend kept running. Restart the services with `scripts/dev.sh`.

**`npm ci` fails or the frontend will not start**
Delete the frontend dependencies and install again:

```bash
rm -rf frontend/node_modules && cd frontend && npm ci
```

**`uv sync` fails or the backend will not start after a Python change**
Recreate the Python environment:

```bash
rm -rf .venv && uv sync
```

## Where to find more

- [Documentation map](../README.md)
- [Privacy and local data](privacy-and-local-data.md)
- [Architecture decision: FastAPI, React and SQLite](../architecture/architecture-decisions/ADR-003-fastapi-react-sqlite-stack.md)
