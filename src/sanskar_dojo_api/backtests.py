"""Backtest logs: calculated results, and saving, reading, editing and deleting logs.

A log is one simulated trade. Prices are per unit: shares for equity, premium for
options, and price for futures. Results are calculated from the stored prices
every time they are read, so they cannot drift from what was entered.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Mapping
from datetime import date, datetime
from typing import Any

RULES_VERSION = 1
# Minimum reward to risk for a log to be saved (the 1:3 rule).
MIN_RR = 3.0
# The target that the R:R minimum is measured to. Trade Gate has one target, stored as target_1.
RR_BASIS = "target_1"
MAX_CHECKS = 60

_SELECT = "SELECT * FROM backtest_logs WHERE profile_id = ?"

# Stored columns, in insert order. The checks are stored separately.
STORED = (
    "segment", "side", "setup_family", "setup_type", "pattern", "instrument",
    "option_type", "strike", "expiry_date", "lot_size", "lots", "quantity",
    "tide_tf", "wave_tf", "ripple_tf",
    "entry_date", "entry_time", "entry_price", "entry_criteria",
    "stop_loss", "target_1", "target_2",
    "exit_date", "exit_time", "exit_price", "exit_reason", "exit_criteria",
    "capital", "spot_price", "margin_used", "observations", "chart_link", "lesson",
)


class BacktestNotFound(Exception):
    """No log with that id for this profile."""


def sign_for(side: str) -> int:
    """A buy profits when price rises, so it counts +1; a sell counts -1."""
    return 1 if side == "buy" else -1


def _as_date(value: date | str) -> date:
    return value if isinstance(value, date) else date.fromisoformat(value)


def calculate(log: Mapping[str, Any]) -> dict[str, Any]:
    """The calculated fields for one log. `log` holds the stored columns; dates may be strings or dates."""
    sign = sign_for(log["side"])
    entry = float(log["entry_price"])
    stop = float(log["stop_loss"])
    target_1 = float(log["target_1"])
    exit_price = float(log["exit_price"])
    quantity = int(log["quantity"])
    capital = float(log["capital"])

    risk_per_unit = abs(entry - stop)
    reward_t1 = sign * (target_1 - entry)
    points = sign * (exit_price - entry)
    pnl = points * quantity

    target_2 = log.get("target_2")
    reward_t2 = sign * (float(target_2) - entry) if target_2 is not None else None

    if pnl > 0:
        category = "win"
    elif pnl < 0:
        category = "loss"
    else:
        category = "breakeven"

    return {
        "risk_per_unit": round(risk_per_unit, 2),
        "risk_taken": round(risk_per_unit * quantity, 2),
        "reward_t1": round(reward_t1, 2),
        "rr_t1": round(reward_t1 / risk_per_unit, 2) if risk_per_unit > 0 else None,
        "reward_t2": round(reward_t2, 2) if reward_t2 is not None else None,
        "rr_t2": round(reward_t2 / risk_per_unit, 2)
        if reward_t2 is not None and risk_per_unit > 0
        else None,
        "points": round(points, 2),
        "pnl": round(pnl, 2),
        "pct": round(points / entry * 100, 2),
        "roi": round(pnl / capital * 100, 2),
        "holding_days": (_as_date(log["exit_date"]) - _as_date(log["entry_date"])).days,
        "pnl_category": category,
    }


def rr_for_minimum(
    side: str, entry: float, stop: float, target_1: float, target_2: float | None
) -> float | None:
    """Reward to risk to the target named by RR_BASIS. None when there is no risk or no target."""
    target = target_1 if RR_BASIS == "target_1" else target_2
    risk = abs(entry - stop)
    if target is None or risk <= 0:
        return None
    return sign_for(side) * (target - entry) / risk


def to_public(row: sqlite3.Row | Mapping[str, Any], checks: list[dict[str, Any]]) -> dict[str, Any]:
    """The API shape of one log: stored fields, ticks and calculated fields."""
    data = dict(row)
    data.pop("profile_id", None)
    data.pop("id", None)
    log_id = row["id"]
    stored = {key: data[key] for key in STORED}
    public = {"id": log_id, **stored, "rules_version": data["rules_version"],
              "created_at": data["created_at"], "updated_at": data["updated_at"],
              "checks": checks}
    public.update(calculate(data))
    return public


def _checks_for(conn: sqlite3.Connection, log_id: int) -> list[dict[str, Any]]:
    rows = conn.execute(
        "SELECT item_id, ticked FROM backtest_log_checks WHERE log_id = ? ORDER BY item_id",
        (log_id,),
    ).fetchall()
    return [{"item_id": row["item_id"], "ticked": bool(row["ticked"])} for row in rows]


def _to_public_row(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    return to_public(row, _checks_for(conn, row["id"]))


def _stored_values(body: Any) -> dict[str, Any]:
    """The stored columns from a validated request body. Dates become ISO strings."""
    values = body.model_dump()
    out: dict[str, Any] = {}
    for key in STORED:
        value = values[key]
        if isinstance(value, date):
            value = value.isoformat()
        out[key] = value
    return out


def list_logs(
    conn: sqlite3.Connection,
    profile_id: int,
    *,
    segment: str | None = None,
    setup_type: str | None = None,
    outcome: str | None = None,
    start: date | None = None,
    end: date | None = None,
) -> list[dict[str, Any]]:
    """Logs for the profile, newest entry first. Outcome is calculated, so it filters in Python."""
    sql = _SELECT
    params: list[Any] = [profile_id]
    if segment is not None:
        sql += " AND segment = ?"
        params.append(segment)
    if setup_type is not None:
        sql += " AND setup_type = ?"
        params.append(setup_type)
    if start is not None:
        sql += " AND entry_date >= ?"
        params.append(start.isoformat())
    if end is not None:
        sql += " AND entry_date <= ?"
        params.append(end.isoformat())
    sql += " ORDER BY entry_date DESC, id DESC"

    logs = [_to_public_row(conn, row) for row in conn.execute(sql, params).fetchall()]
    if outcome is not None:
        logs = [log for log in logs if log["pnl_category"] == outcome]
    return logs


def get_log(conn: sqlite3.Connection, profile_id: int, log_id: int) -> dict[str, Any]:
    row = conn.execute(
        f"{_SELECT} AND id = ?", (profile_id, log_id)
    ).fetchone()
    if row is None:
        raise BacktestNotFound(log_id)
    return _to_public_row(conn, row)


def _write_checks(conn: sqlite3.Connection, log_id: int, checks: list[Any]) -> None:
    conn.executemany(
        "INSERT INTO backtest_log_checks (log_id, item_id, ticked) VALUES (?, ?, ?)",
        [(log_id, check.item_id, 1 if check.ticked else 0) for check in checks],
    )


def create(conn: sqlite3.Connection, profile_id: int, body: Any, moment: datetime) -> dict[str, Any]:
    values = _stored_values(body)
    stamp = moment.isoformat(timespec="seconds")
    columns = ["profile_id", *STORED, "rules_version", "created_at", "updated_at"]
    params = [profile_id, *(values[key] for key in STORED), RULES_VERSION, stamp, stamp]
    placeholders = ", ".join("?" for _ in columns)
    cursor = conn.execute(
        f"INSERT INTO backtest_logs ({', '.join(columns)}) VALUES ({placeholders})",
        params,
    )
    log_id = cursor.lastrowid
    _write_checks(conn, log_id, body.checks)
    return get_log(conn, profile_id, log_id)


def update(
    conn: sqlite3.Connection, profile_id: int, log_id: int, body: Any, moment: datetime
) -> dict[str, Any]:
    get_log(conn, profile_id, log_id)  # raises BacktestNotFound
    values = _stored_values(body)
    assignments = ", ".join(f"{key} = ?" for key in STORED)
    conn.execute(
        f"UPDATE backtest_logs SET {assignments}, updated_at = ? WHERE id = ? AND profile_id = ?",
        [*(values[key] for key in STORED), moment.isoformat(timespec="seconds"), log_id, profile_id],
    )
    conn.execute("DELETE FROM backtest_log_checks WHERE log_id = ?", (log_id,))
    _write_checks(conn, log_id, body.checks)
    return get_log(conn, profile_id, log_id)


def delete(conn: sqlite3.Connection, profile_id: int, log_id: int) -> dict[str, Any]:
    get_log(conn, profile_id, log_id)  # raises BacktestNotFound
    conn.execute("DELETE FROM backtest_logs WHERE id = ? AND profile_id = ?", (log_id, profile_id))
    return {"deleted": log_id}
