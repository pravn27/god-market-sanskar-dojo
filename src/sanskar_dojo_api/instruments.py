"""The instrument list: symbols a profile picks from in Trade Gate and the backtest log.

Trade plans and backtest logs keep the symbol as text, so removing an instrument
from the list never changes a past log. Removal is therefore a plain delete.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Any

from .models import InstrumentFields


class InstrumentNotFound(Exception):
    def __init__(self, instrument_id: int) -> None:
        super().__init__(instrument_id)


class InstrumentExists(Exception):
    def __init__(self, symbol: str) -> None:
        super().__init__(symbol)
        self.symbol = symbol


_SELECT = "SELECT id, symbol, lot_size, created_at, updated_at FROM instruments WHERE profile_id = ?"


def to_public(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    return dict(row)


def list_instruments(conn: sqlite3.Connection, profile_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(f"{_SELECT} ORDER BY symbol", (profile_id,)).fetchall()
    return [to_public(row) for row in rows]


def get_instrument(conn: sqlite3.Connection, profile_id: int, instrument_id: int) -> dict[str, Any]:
    row = conn.execute(f"{_SELECT} AND id = ?", (profile_id, instrument_id)).fetchone()
    if row is None:
        raise InstrumentNotFound(instrument_id)
    return to_public(row)


def create(conn: sqlite3.Connection, profile_id: int, body: InstrumentFields, moment: datetime) -> dict[str, Any]:
    stamp = moment.isoformat(timespec="seconds")
    try:
        cursor = conn.execute(
            "INSERT INTO instruments (profile_id, symbol, lot_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (profile_id, body.symbol, body.lot_size, stamp, stamp),
        )
    except sqlite3.IntegrityError as exc:
        raise InstrumentExists(body.symbol) from exc
    return get_instrument(conn, profile_id, cursor.lastrowid)


def update(
    conn: sqlite3.Connection, profile_id: int, instrument_id: int, body: InstrumentFields, moment: datetime
) -> dict[str, Any]:
    get_instrument(conn, profile_id, instrument_id)  # raises InstrumentNotFound
    try:
        conn.execute(
            "UPDATE instruments SET symbol = ?, lot_size = ?, updated_at = ? WHERE id = ? AND profile_id = ?",
            (body.symbol, body.lot_size, moment.isoformat(timespec="seconds"), instrument_id, profile_id),
        )
    except sqlite3.IntegrityError as exc:
        raise InstrumentExists(body.symbol) from exc
    return get_instrument(conn, profile_id, instrument_id)


def delete(conn: sqlite3.Connection, profile_id: int, instrument_id: int) -> dict[str, Any]:
    get_instrument(conn, profile_id, instrument_id)  # raises InstrumentNotFound
    conn.execute("DELETE FROM instruments WHERE id = ? AND profile_id = ?", (instrument_id, profile_id))
    return {"deleted": instrument_id}
