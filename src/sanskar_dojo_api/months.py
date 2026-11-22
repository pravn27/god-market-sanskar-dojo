"""Calendar views for the History tab: month, week and year, one row per day.

Reads the same rules as `days.py`. Future days are listed but never counted.
Days before the tracker start are listed as untracked: never counted, coloured
or editable.
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

TRACKER_START_DATE = date.fromisoformat(TRACKER_START)
_MONTH = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")
_YEAR = re.compile(r"^\d{4}$")


def parse_month(value: str) -> tuple[int, int]:
    match = _MONTH.match(value)
    if match is None or int(match.group(1)) < 1:
        raise DefinitionError(422, f"Invalid month: {value}. Use YYYY-MM.")
    return int(match.group(1)), int(match.group(2))


def parse_year(value: str) -> int:
    if _YEAR.match(value) is None or int(value) < 1:
        raise DefinitionError(422, f"Invalid year: {value}. Use YYYY.")
    return int(value)


def parse_week_start(value: str) -> date:
    try:
        start = date.fromisoformat(value)
    except ValueError:
        raise DefinitionError(422, f"Invalid week start: {value}. Use YYYY-MM-DD.") from None
    if start.weekday() != 0:
        raise DefinitionError(422, f"Weeks start on a Monday: {value} is not a Monday.")
    # Keeps the previous and next week arithmetic away from the calendar's ends.
    if not date(1900, 1, 1) <= start <= date(9998, 12, 1):
        raise DefinitionError(422, f"Week start must be between 1900 and 9998: {value}.")
    return start


def _label(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def _shift(year: int, month: int, delta: int) -> tuple[int, int]:
    index = year * 12 + (month - 1) + delta
    return index // 12, index % 12 + 1


def day_row(
    conn: sqlite3.Connection,
    profile_id: int,
    day: date,
    today: date,
    *,
    with_rituals: bool = False,
) -> dict[str, Any]:
    """One day's progress. `with_rituals` adds the checklist for the Week view."""
    shown = days.shown_on(conn, profile_id, day)
    done = days.done_keys(conn, profile_id, day)
    daily_total = sum(1 for r in shown if r["cadence"] == "daily")
    daily_done = days.daily_done_count(shown, done)
    future = day > today
    tracked = day >= TRACKER_START_DATE
    row: dict[str, Any] = {
        "date": day.isoformat(),
        "market_day": days.is_market_day(day),
        "future": future,
        "tracked": tracked,
        "editable": tracked and days.is_editable(day, today),
        "shown_total": len(shown),
        "shown_done": sum(1 for r in shown if r["ritual_key"] in done),
        "daily_total": daily_total,
        "daily_done": daily_done,
        # Every tracked, past day gets its colour, weekends included.
        "on_track": tracked and not future and daily_done >= days.STREAK_MIN_DAILY_RITUALS,
        "full": tracked and not future and daily_total > 0 and daily_done == daily_total,
    }
    if with_rituals:
        row["rituals"] = [
            {
                "ritual_key": r["ritual_key"],
                "label": r["label"],
                "minutes": r["minutes"],
                "cadence": r["cadence"],
                "done": r["ritual_key"] in done,
            }
            for r in shown
        ]
    return row


def summarise(rows: list[dict[str, Any]]) -> dict[str, int]:
    """Totals over market days that are tracked and already over."""
    counted = [r for r in rows if r["market_day"] and not r["future"] and r["tracked"]]
    return {
        "market_days": len(counted),
        "on_track_days": sum(1 for r in counted if r["on_track"]),
        "full_days": sum(1 for r in counted if r["full"]),
    }


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
    rows = [day_row(conn, profile_id, date(year, month, d), today) for d in range(1, last + 1)]

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
        "summary": summarise(rows),
    }


def week_view(conn: sqlite3.Connection, profile_id: int, start: date, today: date) -> dict[str, Any]:
    """Monday to Sunday, with each day's checklist."""
    rows = [
        day_row(conn, profile_id, start + timedelta(days=offset), today, with_rituals=True)
        for offset in range(7)
    ]
    this_week = today - timedelta(days=today.weekday())
    previous = start - timedelta(days=7)
    following = start + timedelta(days=7)
    return {
        "week_start": start.isoformat(),
        "week_end": (start + timedelta(days=6)).isoformat(),
        "tracker_start": TRACKER_START,
        # A week is reachable while any of its days is tracked, and until the current week.
        "prev_week": previous.isoformat() if start - timedelta(days=1) >= TRACKER_START_DATE else None,
        "next_week": following.isoformat() if following <= this_week else None,
        "days": rows,
        "summary": summarise(rows),
    }


def year_view(conn: sqlite3.Connection, profile_id: int, year: int, today: date) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    day = date(year, 1, 1)
    while day.year == year:
        rows.append(day_row(conn, profile_id, day, today))
        day += timedelta(days=1)
    return {
        "year": year,
        "tracker_start": TRACKER_START[:4],
        # The previous year is reachable only if it has tracked days, and the next until the current year.
        "prev_year": year - 1 if date(year, 1, 1) > TRACKER_START_DATE else None,
        "next_year": year + 1 if year + 1 <= today.year else None,
        "days": rows,
        "summary": summarise(rows),
    }
