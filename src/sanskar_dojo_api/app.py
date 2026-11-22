"""FastAPI app: opens the local SQLite store, migrates it and seeds the default profile."""

from __future__ import annotations

import os
import sqlite3
import threading
from collections.abc import AsyncIterator, Callable, Iterator
from contextlib import asynccontextmanager
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from . import __version__, days, rituals
from .db import connect, migrate, schema_version
from .models import RitualFields, RitualReorder
from .rituals import DefinitionError
from .seed import PROFILE_SLUG, seed

MARKET_TZ = ZoneInfo("Asia/Kolkata")
API_PREFIX = "/api/v1"
DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "sanskar-dojo.sqlite3"

Clock = Callable[[], datetime]


def market_now() -> datetime:
    return datetime.now(MARKET_TZ)


def db_path_from_env() -> Path:
    return Path(os.environ.get("SANSKAR_DOJO_DB", DEFAULT_DB_PATH))


def create_app(db_path: str | Path | None = None, clock: Clock | None = None) -> FastAPI:
    path = Path(db_path) if db_path is not None else db_path_from_env()
    now = clock or market_now

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        conn = connect(path)
        migrate(conn)
        seed(conn, now().isoformat(timespec="seconds"))
        app.state.conn = conn
        app.state.lock = threading.Lock()
        app.state.db_path = path
        app.state.clock = now
        try:
            yield
        finally:
            conn.close()

    app = FastAPI(title="Sanskar Dojo API", version=__version__, lifespan=lifespan)

    @app.exception_handler(DefinitionError)
    async def definition_error(_: Request, exc: DefinitionError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    def db(request: Request) -> Iterator[sqlite3.Connection]:
        """Yield the shared connection while holding the lock, one request at a time."""
        with request.app.state.lock:
            yield request.app.state.conn

    def profile_id_for(conn: sqlite3.Connection, slug: str) -> int:
        row = conn.execute("SELECT id FROM profiles WHERE slug = ?", (slug,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"Unknown profile: {slug}")
        return row["id"]

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
        profile_id = profile_id_for(conn, slug)
        try:
            day = date.fromisoformat(as_of) if as_of else now().date()
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid date: {as_of}") from exc
        iso_day = day.isoformat()
        rows = rituals.active_on(conn, profile_id, iso_day)
        return {
            "profile": slug,
            "as_of": iso_day,
            "rituals": [rituals.to_public(row) for row in rows],
        }

    @app.post(f"{API_PREFIX}/profiles/{{slug}}/rituals", status_code=201)
    def create_ritual(
        slug: str,
        body: RitualFields,
        conn: sqlite3.Connection = Depends(db),
    ) -> dict:
        profile_id = profile_id_for(conn, slug)
        with conn:
            return rituals.create(conn, profile_id, body, now())

    @app.put(f"{API_PREFIX}/profiles/{{slug}}/rituals/{{ritual_key}}")
    def update_ritual(
        slug: str,
        ritual_key: str,
        body: RitualFields,
        conn: sqlite3.Connection = Depends(db),
    ) -> dict:
        profile_id = profile_id_for(conn, slug)
        with conn:
            return rituals.update(conn, profile_id, ritual_key, body, now())

    @app.delete(f"{API_PREFIX}/profiles/{{slug}}/rituals/{{ritual_key}}")
    def retire_ritual(
        slug: str,
        ritual_key: str,
        conn: sqlite3.Connection = Depends(db),
    ) -> dict:
        profile_id = profile_id_for(conn, slug)
        with conn:
            return rituals.retire(conn, profile_id, ritual_key, now())

    @app.post(f"{API_PREFIX}/profiles/{{slug}}/rituals/reorder")
    def reorder_rituals(
        slug: str,
        body: RitualReorder,
        conn: sqlite3.Connection = Depends(db),
    ) -> dict:
        profile_id = profile_id_for(conn, slug)
        with conn:
            ordered = rituals.reorder(conn, profile_id, body.keys, now())
        return {"profile": slug, "rituals": ordered}

    @app.get(f"{API_PREFIX}/profiles/{{slug}}/days/{{day}}")
    def get_day(slug: str, day: str, conn: sqlite3.Connection = Depends(db)) -> dict:
        profile_id = profile_id_for(conn, slug)
        return days.day_view(conn, profile_id, parse_day(day), now().date())

    @app.post(f"{API_PREFIX}/profiles/{{slug}}/days/{{day}}/rituals/{{ritual_key}}/toggle")
    def toggle_ritual(
        slug: str,
        day: str,
        ritual_key: str,
        conn: sqlite3.Connection = Depends(db),
    ) -> dict:
        profile_id = profile_id_for(conn, slug)
        moment = now()
        with conn:
            return days.toggle(conn, profile_id, parse_day(day), ritual_key, moment.date(), moment)

    return app


def parse_day(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid date: {value}") from exc
