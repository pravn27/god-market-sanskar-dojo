"""FastAPI app: opens the local SQLite store, migrates it and seeds the default profile."""

from __future__ import annotations

import os
import sqlite3
import threading
from collections.abc import AsyncIterator, Callable, Iterator
from contextlib import asynccontextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from . import __version__, backtests, days, instruments, months, rituals
from .db import connect, migrate, schema_version
from .models import (
    BacktestFields,
    InstrumentFields,
    RitualFields,
    RitualReorder,
    Segment,
    SetupType,
)
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

    @app.exception_handler(backtests.BacktestNotFound)
    async def backtest_not_found(_: Request, exc: backtests.BacktestNotFound) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": f"No backtest log with id {exc.args[0]}"})

    @app.exception_handler(instruments.InstrumentNotFound)
    async def instrument_not_found(_: Request, exc: instruments.InstrumentNotFound) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": f"No instrument with id {exc.args[0]}"})

    @app.exception_handler(instruments.InstrumentExists)
    async def instrument_exists(_: Request, exc: instruments.InstrumentExists) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": f"{exc.symbol} is already in the list."})

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

    @app.get(f"{API_PREFIX}/profiles/{{slug}}/months/{{month}}")
    def get_month(slug: str, month: str, conn: sqlite3.Connection = Depends(db)) -> dict:
        profile_id = profile_id_for(conn, slug)
        year, number = months.parse_month(month)
        return months.month_view(conn, profile_id, year, number, now().date())

    @app.get(f"{API_PREFIX}/profiles/{{slug}}/weeks/{{start}}")
    def get_week(slug: str, start: str, conn: sqlite3.Connection = Depends(db)) -> dict:
        profile_id = profile_id_for(conn, slug)
        return months.week_view(conn, profile_id, months.parse_week_start(start), now().date())

    @app.get(f"{API_PREFIX}/profiles/{{slug}}/years/{{year}}")
    def get_year(slug: str, year: str, conn: sqlite3.Connection = Depends(db)) -> dict:
        profile_id = profile_id_for(conn, slug)
        return months.year_view(conn, profile_id, months.parse_year(year), now().date())

    @app.get(f"{API_PREFIX}/profiles/{{slug}}/growth")
    def get_growth(slug: str, conn: sqlite3.Connection = Depends(db)) -> dict:
        profile_id = profile_id_for(conn, slug)
        return months.growth_view(conn, profile_id, now().date())

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

    @app.get(f"{API_PREFIX}/profiles/{{slug}}/backtests")
    def list_backtests(
        slug: str,
        segment: Segment | None = Query(default=None),
        setup_type: SetupType | None = Query(default=None),
        outcome: Literal["win", "loss", "breakeven"] | None = Query(default=None),
        start: str | None = Query(default=None, alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$"),
        end: str | None = Query(default=None, alias="to", pattern=r"^\d{4}-\d{2}-\d{2}$"),
        conn: sqlite3.Connection = Depends(db),
    ) -> dict:
        profile_id = profile_id_for(conn, slug)
        logs = backtests.list_logs(
            conn,
            profile_id,
            segment=segment,
            setup_type=setup_type,
            outcome=outcome,
            start=parse_day(start) if start else None,
            end=parse_day(end) if end else None,
        )
        return {"profile": slug, "backtests": logs}

    @app.post(f"{API_PREFIX}/profiles/{{slug}}/backtests", status_code=201)
    def create_backtest(
        slug: str,
        body: BacktestFields,
        conn: sqlite3.Connection = Depends(db),
    ) -> dict:
        profile_id = profile_id_for(conn, slug)
        with conn:
            return backtests.create(conn, profile_id, body, now())

    @app.get(f"{API_PREFIX}/profiles/{{slug}}/backtests/{{log_id}}")
    def get_backtest(slug: str, log_id: int, conn: sqlite3.Connection = Depends(db)) -> dict:
        profile_id = profile_id_for(conn, slug)
        return backtests.get_log(conn, profile_id, log_id)

    @app.put(f"{API_PREFIX}/profiles/{{slug}}/backtests/{{log_id}}")
    def update_backtest(
        slug: str,
        log_id: int,
        body: BacktestFields,
        conn: sqlite3.Connection = Depends(db),
    ) -> dict:
        profile_id = profile_id_for(conn, slug)
        with conn:
            return backtests.update(conn, profile_id, log_id, body, now())

    @app.delete(f"{API_PREFIX}/profiles/{{slug}}/backtests/{{log_id}}")
    def delete_backtest(slug: str, log_id: int, conn: sqlite3.Connection = Depends(db)) -> dict:
        profile_id = profile_id_for(conn, slug)
        with conn:
            return backtests.delete(conn, profile_id, log_id)

    @app.get(f"{API_PREFIX}/profiles/{{slug}}/instruments")
    def list_instruments(slug: str, conn: sqlite3.Connection = Depends(db)) -> dict:
        profile_id = profile_id_for(conn, slug)
        return {"profile": slug, "instruments": instruments.list_instruments(conn, profile_id)}

    @app.post(f"{API_PREFIX}/profiles/{{slug}}/instruments", status_code=201)
    def create_instrument(
        slug: str,
        body: InstrumentFields,
        conn: sqlite3.Connection = Depends(db),
    ) -> dict:
        profile_id = profile_id_for(conn, slug)
        with conn:
            return instruments.create(conn, profile_id, body, now())

    @app.put(f"{API_PREFIX}/profiles/{{slug}}/instruments/{{instrument_id}}")
    def update_instrument(
        slug: str,
        instrument_id: int,
        body: InstrumentFields,
        conn: sqlite3.Connection = Depends(db),
    ) -> dict:
        profile_id = profile_id_for(conn, slug)
        with conn:
            return instruments.update(conn, profile_id, instrument_id, body, now())

    @app.delete(f"{API_PREFIX}/profiles/{{slug}}/instruments/{{instrument_id}}")
    def delete_instrument(slug: str, instrument_id: int, conn: sqlite3.Connection = Depends(db)) -> dict:
        profile_id = profile_id_for(conn, slug)
        with conn:
            return instruments.delete(conn, profile_id, instrument_id)

    return app


def parse_day(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid date: {value}") from exc
