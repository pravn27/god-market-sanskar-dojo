"""Monthly history: one row per day with its ritual progress, for the History calendar.

Reads the same rules as `days.py`. Future days are listed but never counted.
"""

from __future__ import annotations

import calendar
import re
import sqlite3
from datetime import date, timedelta
from typing import Any

from . import days
from .rituals import DefinitionError
from .seed import TRACKER_START

_MONTH = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")


def parse_month(value: str) -> tuple[int, int]:
    match = _MONTH.match(value)
    if match is None:
        raise DefinitionError(422, f"Invalid month: {value}. Use YYYY-MM.")
    return int(match.group(1)), int(match.group(2))


def _label(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def _shift(year: int, month: int, delta: int) -> tuple[int, int]:
    index = year * 12 + (month - 1) + delta
    return index // 12, index % 12 + 1


def growth_view(conn: sqlite3.Connection, profile_id: int, today: date) -> dict[str, Any]:
    """One summary per month, from the tracker start to the current month."""
    start_year, start_month = (int(part) for part in TRACKER_START[:7].split("-"))
    year, number = start_year, start_month
    months: list[dict[str, Any]] = []
    while (year, number) <= (today.year, today.month):
        view = month_view(conn, profile_id, year, number, today)
        months.append({"month": view["month"], **view["summary"]})
        year, number = _shift(year, number, 1)
    return {"months": months}


def month_view(conn: sqlite3.Connection, profile_id: int, year: int, month: int, today: date) -> dict[str, Any]:
    last = calendar.monthrange(year, month)[1]
    rows: list[dict[str, Any]] = []
    market_days = on_track_days = full_days = 0

    for offset in range(last):
        day = date(year, month, 1) + timedelta(days=offset)
        shown = days.shown_on(conn, profile_id, day)
        done = days.done_keys(conn, profile_id, day)
        daily_total = sum(1 for r in shown if r["cadence"] == "daily")
        daily_done = days.daily_done_count(shown, done)
        market = days.is_market_day(day)
        future = day > today
        # Every past day gets its colour, weekends included. The summary counts market days only.
        on_track = not future and daily_done >= days.STREAK_MIN_DAILY_RITUALS
        full = not future and daily_total > 0 and daily_done == daily_total
        counted = market and not future
        market_days += int(counted)
        on_track_days += int(on_track and counted)
        full_days += int(full and counted)

        rows.append(
            {
                "date": day.isoformat(),
                "market_day": market,
                "future": future,
                "editable": days.is_editable(day, today),
                "shown_total": len(shown),
                "shown_done": sum(1 for r in shown if r["ritual_key"] in done),
                "daily_total": daily_total,
                "daily_done": daily_done,
                "on_track": on_track,
                "full": full,
            }
        )

    prev_year, prev_month = _shift(year, month, -1)
    next_year, next_month = _shift(year, month, 1)
    prev_label = _label(prev_year, prev_month)
    next_label = _label(next_year, next_month)
    current_label = today.strftime("%Y-%m")

    return {
        "month": _label(year, month),
        "tracker_start": TRACKER_START[:7],
        # Navigation stops at the first tracked month and at the current month.
        "prev_month": prev_label if prev_label >= TRACKER_START[:7] else None,
        "next_month": next_label if next_label <= current_label else None,
        "days": rows,
        "summary": {
            "market_days": market_days,
            "on_track_days": on_track_days,
            "full_days": full_days,
        },
    }
