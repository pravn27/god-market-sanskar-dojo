"""Daily Dojo: which rituals apply on a date, ticks, the daily count and the streak.

Calendar rules are weekdays only until a holiday list is configured. These rules
mirror the browser implementation in `frontend/src/domain`, which is the reference
until the frontend reads everything from this API.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime, timedelta
from typing import Any

from . import rituals
from .rituals import DefinitionError

# `streak.min_daily_rituals` in the ASTA rules catalogue.
STREAK_MIN_DAILY_RITUALS = 4
RULES_VERSION = 1


def is_market_day(day: date) -> bool:
    return day.weekday() < 5


def is_weekend(day: date) -> bool:
    return day.weekday() >= 5


def is_last_n_market_days(day: date, n: int) -> bool:
    """True when `day` is one of the last `n` market days of its month."""
    if not is_market_day(day):
        return False
    later_market_days = 0
    probe = day + timedelta(days=1)
    while probe.month == day.month:
        if is_market_day(probe):
            later_market_days += 1
        probe += timedelta(days=1)
    return later_market_days < n


def shows_on(ritual: dict[str, Any], day: date) -> bool:
    cadence = ritual["cadence"]
    if cadence == "daily":
        return True
    if cadence == "weekend":
        return is_weekend(day)
    if cadence == "weekdays":
        sunday_based = (day.weekday() + 1) % 7  # 0 = Sunday, as stored
        return sunday_based in (ritual["weekdays"] or [])
    if cadence == "monthly_last_market_days":
        return is_last_n_market_days(day, ritual["monthly_last_market_days"])
    return False


def _shown_on(conn: sqlite3.Connection, profile_id: int, day: date) -> list[dict[str, Any]]:
    active = rituals.active_on(conn, profile_id, day.isoformat())
    return [r for r in (rituals.to_public(row) for row in active) if shows_on(r, day)]


def _done_keys(conn: sqlite3.Connection, profile_id: int, day: date) -> set[str]:
    rows = conn.execute(
        "SELECT ritual_key FROM ritual_logs WHERE profile_id = ? AND log_date = ?",
        (profile_id, day.isoformat()),
    ).fetchall()
    return {row["ritual_key"] for row in rows}


def _daily_done(shown: list[dict[str, Any]], done: set[str]) -> int:
    return sum(1 for r in shown if r["cadence"] == "daily" and r["ritual_key"] in done)


# Public names for the monthly history, which reads the same rules.
shown_on = _shown_on
done_keys = _done_keys
daily_done_count = _daily_done


def _qualifies(conn: sqlite3.Connection, profile_id: int, day: date) -> bool:
    shown = _shown_on(conn, profile_id, day)
    return _daily_done(shown, _done_keys(conn, profile_id, day)) >= STREAK_MIN_DAILY_RITUALS


def streak(conn: sqlite3.Connection, profile_id: int, day: date) -> int:
    """Consecutive market days ending at `day` with enough daily rituals done.

    Non-market days are skipped. `day` itself never breaks the streak, because
    the day may not be finished yet.
    """
    earliest = conn.execute(
        "SELECT MIN(log_date) FROM ritual_logs WHERE profile_id = ?", (profile_id,)
    ).fetchone()[0]
    if earliest is None:
        return 0

    count = 0
    if is_market_day(day) and _qualifies(conn, profile_id, day):
        count += 1
    probe = day - timedelta(days=1)
    first = date.fromisoformat(earliest)
    while probe >= first:
        if is_market_day(probe):
            if not _qualifies(conn, profile_id, probe):
                break
            count += 1
        probe -= timedelta(days=1)
    return count


def day_view(conn: sqlite3.Connection, profile_id: int, day: date, today: date) -> dict[str, Any]:
    shown = _shown_on(conn, profile_id, day)
    done = _done_keys(conn, profile_id, day)
    return {
        "date": day.isoformat(),
        "editable": day == today,
        "market_day": is_market_day(day),
        "rituals": [
            {
                "ritual_key": r["ritual_key"],
                "label": r["label"],
                "minutes": r["minutes"],
                "cadence": r["cadence"],
                "done": r["ritual_key"] in done,
            }
            for r in shown
        ],
        "daily_done": _daily_done(shown, done),
        "streak": streak(conn, profile_id, day),
    }


def toggle(
    conn: sqlite3.Connection,
    profile_id: int,
    day: date,
    ritual_key: str,
    today: date,
    now: datetime,
) -> dict[str, Any]:
    """Tick or untick a ritual. Only today can change, and only rituals shown that day."""
    if day > today:
        raise DefinitionError(400, "Check-ins for a future date are not allowed.")
    if day < today:
        raise DefinitionError(400, "Past days are read-only.")
    shown_keys = {r["ritual_key"] for r in _shown_on(conn, profile_id, day)}
    if ritual_key not in shown_keys:
        raise DefinitionError(404, f"Unknown ritual for this day: {ritual_key}")

    iso = day.isoformat()
    now_iso = now.isoformat(timespec="seconds")
    existing = conn.execute(
        "SELECT id FROM ritual_logs WHERE profile_id = ? AND log_date = ? AND ritual_key = ?",
        (profile_id, iso, ritual_key),
    ).fetchone()
    if existing:
        conn.execute("DELETE FROM ritual_logs WHERE id = ?", (existing["id"],))
        event_type = "untick"
    else:
        conn.execute(
            "INSERT INTO ritual_logs (profile_id, log_date, ritual_key, done_at) VALUES (?, ?, ?, ?)",
            (profile_id, iso, ritual_key, now_iso),
        )
        event_type = "tick"
    conn.execute(
        """INSERT INTO ritual_events (profile_id, event_type, log_date, ritual_key, payload, rules_version, at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (profile_id, event_type, iso, ritual_key, json.dumps({}), RULES_VERSION, now_iso),
    )
    return day_view(conn, profile_id, day, today)
