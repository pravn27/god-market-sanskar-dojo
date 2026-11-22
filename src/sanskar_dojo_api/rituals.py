"""Ritual definitions: create, edit, retire and reorder, with effective-dated history.

Changes always apply from today (Asia/Kolkata). A past version is never edited:
an edit closes the open version on today's date and opens a new one, so past
days keep the definition that applied to them. A change made on the day a
version was created edits that version in place, so no empty version is left.
"""

from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime
from typing import Any

from .models import RitualFields

MAX_ACTIVE_RITUALS = 12
RULES_VERSION = 1

_FIELD_COLUMNS = (
    "label",
    "minutes",
    "cadence",
    "weekdays",
    "monthly_last_market_days",
    "counts_for_streak",
    "sort_order",
)
_SELECT = (
    "SELECT id, profile_id, ritual_key, label, minutes, cadence, weekdays, monthly_last_market_days, "
    "counts_for_streak, sort_order, valid_from, valid_to FROM ritual_defs"
)


class DefinitionError(Exception):
    """A rule the request broke. Mapped to an HTTP status by the app."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def to_public(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    """Shape a stored definition for the API."""
    data = dict(row)
    weekdays = data.get("weekdays")
    if isinstance(weekdays, str):
        data["weekdays"] = [int(day) for day in weekdays.split(",")] if weekdays else None
    data["counts_for_streak"] = bool(data["counts_for_streak"])
    for internal in ("id", "profile_id"):
        data.pop(internal, None)
    return data


def slugify(label: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")
    return slug[:40] or "ritual"


def open_version(conn: sqlite3.Connection, profile_id: int, key: str) -> sqlite3.Row | None:
    return conn.execute(
        f"{_SELECT} WHERE profile_id = ? AND ritual_key = ? AND valid_to IS NULL",
        (profile_id, key),
    ).fetchone()


def active_on(conn: sqlite3.Connection, profile_id: int, day: str) -> list[sqlite3.Row]:
    return conn.execute(
        f"""{_SELECT}
            WHERE profile_id = ? AND archived = 0
              AND valid_from <= ? AND (valid_to IS NULL OR valid_to > ?)
            ORDER BY sort_order""",
        (profile_id, day, day),
    ).fetchall()


def _key_exists(conn: sqlite3.Connection, profile_id: int, key: str) -> bool:
    # Keys are never reused, including by rituals that were retired.
    return conn.execute(
        "SELECT 1 FROM ritual_defs WHERE profile_id = ? AND ritual_key = ?", (profile_id, key)
    ).fetchone() is not None


def _new_key(conn: sqlite3.Connection, profile_id: int, label: str) -> str:
    base = slugify(label)
    key, suffix = base, 2
    while _key_exists(conn, profile_id, key):
        key = f"{base}_{suffix}"
        suffix += 1
    return key


def _check_label_free(active: list[sqlite3.Row], label: str, own_key: str | None = None) -> None:
    wanted = label.casefold()
    for row in active:
        if row["ritual_key"] != own_key and row["label"].casefold() == wanted:
            raise DefinitionError(409, f"A ritual called '{label}' is already active.")


def _check_capacity(active: list[sqlite3.Row]) -> None:
    if len(active) >= MAX_ACTIVE_RITUALS:
        raise DefinitionError(409, f"You can have up to {MAX_ACTIVE_RITUALS} active rituals.")


def _weekdays_text(weekdays: list[int] | None) -> str | None:
    return ",".join(str(day) for day in weekdays) if weekdays else None


def _field_values(row: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    data = to_public(row)
    return {name: data[name] for name in _FIELD_COLUMNS}


def _replace_version(
    conn: sqlite3.Connection,
    current: sqlite3.Row,
    values: dict[str, Any],
    today: str,
    now_iso: str,
) -> None:
    """Write new field values for a ritual as of today."""
    if current["valid_from"] == today:
        conn.execute(
            """UPDATE ritual_defs
               SET label = ?, minutes = ?, cadence = ?, weekdays = ?,
                   monthly_last_market_days = ?, counts_for_streak = ?, sort_order = ?
               WHERE id = ?""",
            (
                values["label"],
                values["minutes"],
                values["cadence"],
                _weekdays_text(values["weekdays"]),
                values["monthly_last_market_days"],
                int(values["counts_for_streak"]),
                values["sort_order"],
                current["id"],
            ),
        )
        return
    conn.execute("UPDATE ritual_defs SET valid_to = ? WHERE id = ?", (today, current["id"]))
    conn.execute(
        """INSERT INTO ritual_defs (
               profile_id, ritual_key, label, minutes, cadence, weekdays,
               monthly_last_market_days, counts_for_streak, sort_order,
               archived, valid_from, valid_to, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, ?)""",
        (
            current["profile_id"],
            current["ritual_key"],
            values["label"],
            values["minutes"],
            values["cadence"],
            _weekdays_text(values["weekdays"]),
            values["monthly_last_market_days"],
            int(values["counts_for_streak"]),
            values["sort_order"],
            today,
            now_iso,
        ),
    )


def _event(
    conn: sqlite3.Connection,
    profile_id: int,
    event_type: str,
    key: str,
    payload: dict[str, Any],
    today: str,
    now_iso: str,
) -> None:
    conn.execute(
        """INSERT INTO ritual_events (profile_id, event_type, log_date, ritual_key, payload, rules_version, at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (profile_id, event_type, today, key, json.dumps(payload, default=str), RULES_VERSION, now_iso),
    )


def _stamp(now: datetime) -> tuple[str, str]:
    return now.date().isoformat(), now.isoformat(timespec="seconds")


def create(conn: sqlite3.Connection, profile_id: int, fields: RitualFields, now: datetime) -> dict[str, Any]:
    today, now_iso = _stamp(now)
    active = active_on(conn, profile_id, today)
    _check_capacity(active)
    _check_label_free(active, fields.label)
    key = _new_key(conn, profile_id, fields.label)
    sort_order = max((row["sort_order"] for row in active), default=0) + 1
    values = {**fields.model_dump(), "sort_order": sort_order}
    conn.execute(
        """INSERT INTO ritual_defs (
               profile_id, ritual_key, label, minutes, cadence, weekdays,
               monthly_last_market_days, counts_for_streak, sort_order,
               archived, valid_from, valid_to, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, ?)""",
        (
            profile_id,
            key,
            values["label"],
            values["minutes"],
            values["cadence"],
            _weekdays_text(values["weekdays"]),
            values["monthly_last_market_days"],
            int(values["counts_for_streak"]),
            sort_order,
            today,
            now_iso,
        ),
    )
    _event(conn, profile_id, "def_created", key, values, today, now_iso)
    return get(conn, profile_id, key, today)


def update(
    conn: sqlite3.Connection, profile_id: int, key: str, fields: RitualFields, now: datetime
) -> dict[str, Any]:
    today, now_iso = _stamp(now)
    current = open_version(conn, profile_id, key)
    if current is None:
        raise DefinitionError(404, f"No active ritual '{key}'.")
    _check_label_free(active_on(conn, profile_id, today), fields.label, own_key=key)
    before = _field_values(current)
    after = {**fields.model_dump(), "sort_order": current["sort_order"]}
    _replace_version(conn, current, after, today, now_iso)
    _event(conn, profile_id, "def_updated", key, {"before": before, "after": after}, today, now_iso)
    return get(conn, profile_id, key, today)


def retire(conn: sqlite3.Connection, profile_id: int, key: str, now: datetime) -> dict[str, Any]:
    today, now_iso = _stamp(now)
    current = open_version(conn, profile_id, key)
    if current is None:
        raise DefinitionError(404, f"No active ritual '{key}'.")
    if current["valid_from"] == today:
        raise DefinitionError(
            409, "This ritual started today. Edit it instead, or retire it from tomorrow."
        )
    conn.execute("UPDATE ritual_defs SET valid_to = ? WHERE id = ?", (today, current["id"]))
    _event(conn, profile_id, "def_archived", key, {"last_day": today}, today, now_iso)
    return {"ritual_key": key, "retired_from": today}


def reorder(
    conn: sqlite3.Connection, profile_id: int, keys: list[str], now: datetime
) -> list[dict[str, Any]]:
    today, now_iso = _stamp(now)
    active = active_on(conn, profile_id, today)
    if len(set(keys)) != len(keys) or sorted(keys) != sorted(row["ritual_key"] for row in active):
        raise DefinitionError(422, "keys must list every active ritual exactly once.")
    for position, key in enumerate(keys, start=1):
        current = open_version(conn, profile_id, key)
        if current["sort_order"] == position:
            continue
        before = _field_values(current)
        after = {**before, "sort_order": position}
        _replace_version(conn, current, after, today, now_iso)
        _event(
            conn,
            profile_id,
            "def_updated",
            key,
            {"before": {"sort_order": before["sort_order"]}, "after": {"sort_order": position}},
            today,
            now_iso,
        )
    return [get(conn, profile_id, key, today) for key in keys]


def get(conn: sqlite3.Connection, profile_id: int, key: str, day: str) -> dict[str, Any]:
    row = conn.execute(
        f"{_SELECT} WHERE profile_id = ? AND ritual_key = ? AND valid_from <= ? "
        "AND (valid_to IS NULL OR valid_to > ?) ORDER BY valid_from DESC LIMIT 1",
        (profile_id, key, day, day),
    ).fetchone()
    if row is None:
        raise DefinitionError(404, f"No ritual '{key}' on {day}.")
    return to_public(row)
