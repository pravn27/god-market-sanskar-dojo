"""Numbered schema migrations. Append only: never edit a migration that has shipped.

Migration 1 creates every table for the profile-scoped data that exists in the
design today. Scores, locks, reviews, XP, backtests and actual trade executions
arrive in later migrations, once their rules are specified.

Dates are ISO `YYYY-MM-DD` strings in the Asia/Kolkata market calendar.
Timestamps are ISO 8601 with offset.
"""

V1_PROFILES_AND_RITUALS = """
CREATE TABLE profiles (
    id           INTEGER PRIMARY KEY,
    slug         TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at   TEXT NOT NULL
);

-- Versioned ritual definitions. A change closes the current row (valid_to)
-- and opens a new one, so past days keep the definition that applied to them.
CREATE TABLE ritual_defs (
    id                         INTEGER PRIMARY KEY,
    profile_id                 INTEGER NOT NULL REFERENCES profiles(id),
    ritual_key                 TEXT NOT NULL,
    label                      TEXT NOT NULL,
    minutes                    INTEGER NOT NULL CHECK (minutes BETWEEN 1 AND 240),
    cadence                    TEXT NOT NULL CHECK (
                                   cadence IN ('daily', 'weekdays', 'weekend', 'monthly_last_market_days')),
    weekdays                   TEXT,
    monthly_last_market_days   INTEGER CHECK (monthly_last_market_days IS NULL
                                              OR monthly_last_market_days BETWEEN 1 AND 5),
    counts_for_streak          INTEGER NOT NULL DEFAULT 1 CHECK (counts_for_streak IN (0, 1)),
    sort_order                 INTEGER NOT NULL,
    archived                   INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    valid_from                 TEXT NOT NULL,
    valid_to                   TEXT,
    created_at                 TEXT NOT NULL,
    CHECK (valid_to IS NULL OR valid_to > valid_from),
    CHECK ((cadence = 'weekdays') = (weekdays IS NOT NULL)),
    CHECK ((cadence = 'monthly_last_market_days') = (monthly_last_market_days IS NOT NULL))
);

CREATE INDEX ritual_defs_lookup ON ritual_defs (profile_id, ritual_key, valid_from);

-- One row per profile, date and ritual that was ticked.
CREATE TABLE ritual_logs (
    id          INTEGER PRIMARY KEY,
    profile_id  INTEGER NOT NULL REFERENCES profiles(id),
    log_date    TEXT NOT NULL,
    ritual_key  TEXT NOT NULL,
    done_at     TEXT NOT NULL,
    UNIQUE (profile_id, log_date, ritual_key)
);

CREATE INDEX ritual_logs_by_date ON ritual_logs (profile_id, log_date);

-- Append-only record of every change: ticks, unticks and definition changes.
CREATE TABLE ritual_events (
    id             INTEGER PRIMARY KEY,
    profile_id     INTEGER NOT NULL REFERENCES profiles(id),
    event_type     TEXT NOT NULL CHECK (event_type IN (
                       'tick', 'untick', 'def_created', 'def_updated', 'def_archived')),
    log_date       TEXT,
    ritual_key     TEXT,
    payload        TEXT,
    rules_version  INTEGER NOT NULL,
    at             TEXT NOT NULL
);

CREATE TRIGGER ritual_events_no_update BEFORE UPDATE ON ritual_events
BEGIN
    SELECT RAISE(ABORT, 'ritual_events is append-only');
END;

CREATE TRIGGER ritual_events_no_delete BEFORE DELETE ON ritual_events
BEGIN
    SELECT RAISE(ABORT, 'ritual_events is append-only');
END;
"""

V1_TRADE_GATE = """
CREATE TABLE trade_plans (
    id             INTEGER PRIMARY KEY,
    profile_id     INTEGER NOT NULL REFERENCES profiles(id),
    plan_date      TEXT NOT NULL,
    instrument     TEXT NOT NULL,
    segment        TEXT NOT NULL CHECK (segment IN ('equity', 'futures', 'options')),
    side           TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    option_type    TEXT CHECK (option_type IS NULL OR option_type IN ('CE', 'PE')),
    capital        REAL NOT NULL CHECK (capital > 0),
    conviction     TEXT NOT NULL CHECK (conviction IN (
                       'below_low', 'low', 'medium', 'high', 'above_high')),
    entry          REAL NOT NULL CHECK (entry > 0),
    stop_loss      REAL NOT NULL CHECK (stop_loss > 0),
    target         REAL NOT NULL CHECK (target > 0),
    lot_size       INTEGER CHECK (lot_size IS NULL OR lot_size > 0),
    quantity       INTEGER NOT NULL CHECK (quantity > 0),
    risk_allowed   REAL NOT NULL CHECK (risk_allowed >= 0),
    actual_risk    REAL NOT NULL CHECK (actual_risk >= 0),
    reward_risk    REAL NOT NULL,
    setup          TEXT,
    status         TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'entered', 'skipped')),
    rules_version  INTEGER NOT NULL,
    created_at     TEXT NOT NULL,
    CHECK ((segment = 'options') = (option_type IS NOT NULL)),
    CHECK ((segment = 'equity') = (lot_size IS NULL))
);

CREATE INDEX trade_plans_by_date ON trade_plans (profile_id, plan_date);

-- Checklist ticks for a plan, one row per checklist item.
CREATE TABLE plan_checks (
    plan_id  INTEGER NOT NULL REFERENCES trade_plans(id) ON DELETE CASCADE,
    item_id  TEXT NOT NULL,
    ticked   INTEGER NOT NULL CHECK (ticked IN (0, 1)),
    PRIMARY KEY (plan_id, item_id)
);

-- One exit per plan.
CREATE TABLE trade_exits (
    id          INTEGER PRIMARY KEY,
    plan_id     INTEGER NOT NULL UNIQUE REFERENCES trade_plans(id),
    exit_date   TEXT NOT NULL,
    exit_price  REAL NOT NULL CHECK (exit_price > 0),
    reason      TEXT NOT NULL CHECK (reason IN (
                    'planned_target', 'planned_stop', 'trail_stop',
                    'view_invalidated', 'early_book', 'other')),
    sl_moved    INTEGER NOT NULL DEFAULT 0 CHECK (sl_moved IN (0, 1)),
    note        TEXT,
    created_at  TEXT NOT NULL
);
"""

MIGRATIONS: tuple[str, ...] = (
    V1_PROFILES_AND_RITUALS + V1_TRADE_GATE,
)
