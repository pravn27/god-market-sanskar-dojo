"""FastAPI app: opens the local SQLite store, migrates it and seeds the default profile."""

from __future__ import annotations

import os
import sqlite3
import threading
from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException, Query, Request

from . import __version__
from .db import connect, migrate, schema_version
from .seed import PROFILE_SLUG, seed

MARKET_TZ = ZoneInfo("Asia/Kolkata")
API_PREFIX = "/api/v1"
DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "sanskar-dojo.sqlite3"


def now_iso() -> str:
    return datetime.now(MARKET_TZ).isoformat(timespec="seconds")


def db_path_from_env() -> Path:
    return Path(os.environ.get("SANSKAR_DOJO_DB", DEFAULT_DB_PATH))


def create_app(db_path: str | Path | None = None) -> FastAPI:
    path = Path(db_path) if db_path is not None else db_path_from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        conn = connect(path)
        migrate(conn)
        seed(conn, now_iso())
        app.state.conn = conn
        app.state.lock = threading.Lock()
        app.state.db_path = path
        try:
            yield
        finally:
            conn.close()

    app = FastAPI(title="Sanskar Dojo API", version=__version__, lifespan=lifespan)

    def db(request: Request) -> Iterator[sqlite3.Connection]:
        """Yield the shared connection while holding the lock, one request at a time."""
        with request.app.state.lock:
            yield request.app.state.conn

    @app.get(f"{API_PREFIX}/health")
    def health(request: Request, conn: sqlite3.Connection = Depends(db)) -> dict:
        return {
            "status": "ok",
            "version": __version__,
            "schema_version": schema_version(conn),
            "profile": PROFILE_SLUG,
            "database": str(request.app.state.db_path),
        }

    @app.get(f"{API_PREFIX}/profiles")
    def list_profiles(conn: sqlite3.Connection = Depends(db)) -> list[dict]:
        rows = conn.execute("SELECT slug, display_name, created_at FROM profiles ORDER BY id").fetchall()
        return [dict(row) for row in rows]

    @app.get(f"{API_PREFIX}/profiles/{{slug}}/rituals")
    def rituals_for_date(
        slug: str,
        as_of: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
        conn: sqlite3.Connection = Depends(db),
    ) -> dict:
        profile = conn.execute("SELECT id FROM profiles WHERE slug = ?", (slug,)).fetchone()
        if profile is None:
            raise HTTPException(status_code=404, detail=f"Unknown profile: {slug}")
        try:
            day = date.fromisoformat(as_of) if as_of else datetime.now(MARKET_TZ).date()
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid date: {as_of}") from exc
        iso_day = day.isoformat()
        rows = conn.execute(
            """
            SELECT ritual_key, label, minutes, cadence, weekdays, monthly_last_market_days,
                   counts_for_streak, sort_order
            FROM ritual_defs
            WHERE profile_id = ? AND archived = 0
              AND valid_from <= ? AND (valid_to IS NULL OR valid_to > ?)
            ORDER BY sort_order
            """,
            (profile["id"], iso_day, iso_day),
        ).fetchall()
        return {
            "profile": slug,
            "as_of": iso_day,
            "rituals": [
                {**dict(row), "counts_for_streak": bool(row["counts_for_streak"])} for row in rows
            ],
        }

    return app
