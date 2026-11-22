import sqlite3

import pytest

from sanskar_dojo_api.db import connect, migrate, schema_version
from sanskar_dojo_api.seed import DEFAULT_RITUALS, PROFILE_SLUG, seed

NOW = "2026-11-22T18:00:00+05:30"

EXPECTED_TABLES = {
    "profiles",
    "ritual_defs",
    "ritual_logs",
    "ritual_events",
    "trade_plans",
    "plan_checks",
    "trade_exits",
}


@pytest.fixture
def conn(tmp_path):
    connection = connect(tmp_path / "store.sqlite3")
    migrate(connection)
    yield connection
    connection.close()


def table_names(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    return {row["name"] for row in rows}


def make_profile(conn: sqlite3.Connection, slug: str = "tester") -> int:
    cur = conn.execute(
        "INSERT INTO profiles (slug, display_name, created_at) VALUES (?, ?, ?)",
        (slug, slug.title(), NOW),
    )
    return cur.lastrowid


def test_migrate_creates_every_table_and_sets_version(conn):
    assert EXPECTED_TABLES <= table_names(conn)
    assert schema_version(conn) == 1


def test_migrate_is_a_no_op_when_current(conn):
    assert migrate(conn) == 1


def test_newer_schema_is_refused(tmp_path):
    conn = connect(tmp_path / "newer.sqlite3")
    conn.execute("PRAGMA user_version = 99")
    with pytest.raises(RuntimeError, match="newer than this code"):
        migrate(conn)
    conn.close()


def test_failed_migration_is_rolled_back_and_not_recorded(tmp_path):
    conn = connect(tmp_path / "broken.sqlite3")
    migrations = (
        "CREATE TABLE first_ok (id INTEGER PRIMARY KEY);",
        "CREATE TABLE first_ok (id INTEGER PRIMARY KEY);",  # fails: table already exists
    )
    with pytest.raises(sqlite3.Error):
        migrate(conn, migrations)
    assert schema_version(conn) == 1
    assert "first_ok" in table_names(conn)
    assert not conn.in_transaction
    conn.close()


def test_foreign_keys_are_enforced(conn):
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            "INSERT INTO ritual_logs (profile_id, log_date, ritual_key, done_at) VALUES (999, '2026-01-01', 'x', ?)",
            (NOW,),
        )


def test_profile_slug_is_unique(conn):
    make_profile(conn, "dup")
    with pytest.raises(sqlite3.IntegrityError):
        make_profile(conn, "dup")


def test_seed_creates_praveen_with_the_eight_rituals(conn):
    with conn:
        added = seed(conn, NOW)
    assert added == len(DEFAULT_RITUALS) == 8
    profile = conn.execute("SELECT id, display_name FROM profiles WHERE slug = ?", (PROFILE_SLUG,)).fetchone()
    assert profile["display_name"] == "Praveen"
    count = conn.execute(
        "SELECT COUNT(*) FROM ritual_defs WHERE profile_id = ? AND valid_to IS NULL", (profile["id"],)
    ).fetchone()[0]
    assert count == 8
    events = conn.execute(
        "SELECT COUNT(*) FROM ritual_events WHERE event_type = 'def_created'"
    ).fetchone()[0]
    assert events == 8


def test_seed_is_idempotent(conn):
    with conn:
        seed(conn, NOW)
    with conn:
        assert seed(conn, NOW) == 0
    total = conn.execute("SELECT COUNT(*) FROM ritual_defs").fetchone()[0]
    assert total == 8


def test_ritual_cadence_requires_its_matching_field(conn):
    profile_id = make_profile(conn)
    base = (
        "INSERT INTO ritual_defs (profile_id, ritual_key, label, minutes, cadence, weekdays, "
        "monthly_last_market_days, counts_for_streak, sort_order, archived, valid_from, created_at) "
        "VALUES (?, 'k', 'K', 10, ?, ?, ?, 1, 1, 0, '2026-01-01', ?)"
    )
    with pytest.raises(sqlite3.IntegrityError):  # weekdays cadence without weekdays
        conn.execute(base, (profile_id, "weekdays", None, None, NOW))
    with pytest.raises(sqlite3.IntegrityError):  # monthly cadence without a count
        conn.execute(base, (profile_id, "monthly_last_market_days", None, None, NOW))


def test_ritual_definition_versions_cannot_end_before_they_start(conn):
    profile_id = make_profile(conn)
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            "INSERT INTO ritual_defs (profile_id, ritual_key, label, minutes, cadence, sort_order, archived, "
            "valid_from, valid_to, created_at) VALUES (?, 'k', 'K', 10, 'daily', 1, 0, '2026-02-01', '2026-01-01', ?)",
            (profile_id, NOW),
        )


def test_one_log_per_profile_day_and_ritual(conn):
    profile_id = make_profile(conn)
    insert = "INSERT INTO ritual_logs (profile_id, log_date, ritual_key, done_at) VALUES (?, ?, ?, ?)"
    conn.execute(insert, (profile_id, "2026-01-02", "backtesting", NOW))
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(insert, (profile_id, "2026-01-02", "backtesting", NOW))


def test_ritual_events_are_append_only(conn):
    profile_id = make_profile(conn)
    conn.execute(
        "INSERT INTO ritual_events (profile_id, event_type, log_date, ritual_key, rules_version, at) "
        "VALUES (?, 'tick', '2026-01-02', 'backtesting', 1, ?)",
        (profile_id, NOW),
    )
    with pytest.raises(sqlite3.Error, match="append-only"):
        conn.execute("UPDATE ritual_events SET ritual_key = 'changed'")
    with pytest.raises(sqlite3.Error, match="append-only"):
        conn.execute("DELETE FROM ritual_events")


def test_options_plans_need_an_option_type_and_equity_plans_must_not_have_a_lot_size(conn):
    profile_id = make_profile(conn)
    insert = (
        "INSERT INTO trade_plans (profile_id, plan_date, instrument, segment, side, option_type, capital, "
        "conviction, entry, stop_loss, target, lot_size, quantity, risk_allowed, actual_risk, reward_risk, "
        "rules_version, created_at) VALUES (?, '2026-01-05', 'NIFTY', ?, 'buy', ?, 100000, 'medium', 100, 90, 130, ?, "
        "1, 1000, 900, 3, 1, ?)"
    )
    with pytest.raises(sqlite3.IntegrityError):  # options without CE or PE
        conn.execute(insert, (profile_id, "options", None, 75, NOW))
    with pytest.raises(sqlite3.IntegrityError):  # equity with a lot size
        conn.execute(insert, (profile_id, "equity", None, 75, NOW))
    conn.execute(insert, (profile_id, "options", "CE", 75, NOW))  # valid


def test_one_exit_per_plan(conn):
    profile_id = make_profile(conn)
    plan = conn.execute(
        "INSERT INTO trade_plans (profile_id, plan_date, instrument, segment, side, capital, conviction, entry, "
        "stop_loss, target, quantity, risk_allowed, actual_risk, reward_risk, rules_version, created_at) "
        "VALUES (?, '2026-01-05', 'RELIANCE', 'equity', 'buy', 100000, 'low', 100, 90, 130, 10, 500, 500, 3, 1, ?)",
        (profile_id, NOW),
    ).lastrowid
    insert = (
        "INSERT INTO trade_exits (plan_id, exit_date, exit_price, reason, created_at) "
        "VALUES (?, '2026-01-06', 130, 'planned_target', ?)"
    )
    conn.execute(insert, (plan, NOW))
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(insert, (plan, NOW))
