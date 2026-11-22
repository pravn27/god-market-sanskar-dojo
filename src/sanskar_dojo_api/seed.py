"""Seed the profile "praveen" and its default rituals. Safe to run more than once."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass

RULES_VERSION = 1
PROFILE_SLUG = "praveen"
PROFILE_NAME = "Praveen"
# Tracker history starts on 1 January 2026, so the definitions apply from then.
TRACKER_START = "2026-01-01"


@dataclass(frozen=True)
class RitualSeed:
    ritual_key: str
    label: str
    minutes: int
    cadence: str
    weekdays: str | None = None
    monthly_last_market_days: int | None = None
    counts_for_streak: bool = True


# Seeded from the setup sheet of `2026/daily rituals _ habits.xlsx`.
DEFAULT_RITUALS: tuple[RitualSeed, ...] = (
    RitualSeed("market_overview", "Daily Rituals on Market Overview", 45, "daily"),
    RitualSeed("backtesting", "Daily Backtesting", 30, "daily"),
    RitualSeed("geo_revision", "Repeat, learn and clear concepts: Full GEO revision", 15, "daily"),
    RitualSeed("webinar", "MyASTA webinar recording session", 20, "daily"),
    RitualSeed("preparation", "Market preparation, execution planning, money management", 10, "daily"),
    RitualSeed("buddy_connect", "Accountability buddy connect", 15, "daily"),
    RitualSeed("opportunity_hunting", "Opportunity hunting: Nifty sectors vs stocks", 60, "weekend",
               counts_for_streak=False),
    RitualSeed("log_audit", "Trade log update and SWOT review", 60, "monthly_last_market_days",
               monthly_last_market_days=2, counts_for_streak=False),
)


def ensure_profile(conn: sqlite3.Connection, now: str) -> int:
    """Create the profile if missing and return its id."""
    conn.execute(
        "INSERT OR IGNORE INTO profiles (slug, display_name, created_at) VALUES (?, ?, ?)",
        (PROFILE_SLUG, PROFILE_NAME, now),
    )
    row = conn.execute("SELECT id FROM profiles WHERE slug = ?", (PROFILE_SLUG,)).fetchone()
    return int(row["id"])


def seed_default_rituals(conn: sqlite3.Connection, profile_id: int, now: str) -> int:
    """Insert each default ritual that the profile does not have yet.

    Returns how many definitions were added. A ritual that already exists for
    the profile is left alone, so running this again changes nothing.
    """
    added = 0
    for order, ritual in enumerate(DEFAULT_RITUALS, start=1):
        exists = conn.execute(
            "SELECT 1 FROM ritual_defs WHERE profile_id = ? AND ritual_key = ?",
            (profile_id, ritual.ritual_key),
        ).fetchone()
        if exists:
            continue
        conn.execute(
            """
            INSERT INTO ritual_defs (
                profile_id, ritual_key, label, minutes, cadence, weekdays,
                monthly_last_market_days, counts_for_streak, sort_order,
                archived, valid_from, valid_to, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, ?)
            """,
            (
                profile_id,
                ritual.ritual_key,
                ritual.label,
                ritual.minutes,
                ritual.cadence,
                ritual.weekdays,
                ritual.monthly_last_market_days,
                int(ritual.counts_for_streak),
                order,
                TRACKER_START,
                now,
            ),
        )
        conn.execute(
            """
            INSERT INTO ritual_events (profile_id, event_type, ritual_key, payload, rules_version, at)
            VALUES (?, 'def_created', ?, ?, ?, ?)
            """,
            (
                profile_id,
                ritual.ritual_key,
                json.dumps({"label": ritual.label, "minutes": ritual.minutes, "cadence": ritual.cadence}),
                RULES_VERSION,
                now,
            ),
        )
        added += 1
    return added


def seed(conn: sqlite3.Connection, now: str) -> int:
    """Create the profile and its default rituals in one transaction."""
    with conn:
        profile_id = ensure_profile(conn, now)
        return seed_default_rituals(conn, profile_id, now)
