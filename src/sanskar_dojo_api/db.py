"""SQLite connection and numbered migrations.

The schema version is stored in SQLite's own `user_version`, so no extra
migration library is needed. Each migration runs once, in order, inside its
own transaction: if it fails, nothing from it is kept and the version is not
bumped.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Sequence
from pathlib import Path

from .migrations import MIGRATIONS

PRAGMAS = (
    "PRAGMA foreign_keys = ON",
    "PRAGMA journal_mode = WAL",
    "PRAGMA busy_timeout = 5000",
)


def connect(path: str | Path) -> sqlite3.Connection:
    """Open a connection with foreign keys, WAL mode and a busy timeout."""
    if str(path) != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    for pragma in PRAGMAS:
        conn.execute(pragma)
    return conn


def schema_version(conn: sqlite3.Connection) -> int:
    return int(conn.execute("PRAGMA user_version").fetchone()[0])


def migrate(conn: sqlite3.Connection, migrations: Sequence[str] = MIGRATIONS) -> int:
    """Apply pending migrations and return the resulting schema version."""
    current = schema_version(conn)
    latest = len(migrations)
    if current > latest:
        raise RuntimeError(
            f"Database schema version {current} is newer than this code ({latest}). "
            "Update the application instead of downgrading the database."
        )
    for version in range(current + 1, latest + 1):
        script = (
            "BEGIN;\n"
            f"{migrations[version - 1]}\n"
            f"PRAGMA user_version = {version};\n"
            "COMMIT;"
        )
        try:
            conn.executescript(script)
        except sqlite3.Error:
            # A failed statement leaves the transaction open; undo it and re-raise.
            if conn.in_transaction:
                conn.execute("ROLLBACK")
            raise
    return schema_version(conn)
