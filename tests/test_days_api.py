import json
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from sanskar_dojo_api.app import create_app

KOLKATA = ZoneInfo("Asia/Kolkata")
BASE = "/api/v1/profiles/praveen"
DAILY = ["market_overview", "backtesting", "geo_revision", "webinar", "preparation", "buddy_connect"]


class Clock:
    def __init__(self, day: str) -> None:
        self.move_to(day)

    def __call__(self) -> datetime:
        return self.now

    def move_to(self, day: str) -> None:
        self.now = datetime.fromisoformat(f"{day}T09:00:00").replace(tzinfo=KOLKATA)


@pytest.fixture
def clock():
    return Clock("2026-11-22")  # a Sunday


@pytest.fixture
def app(tmp_path, clock):
    return create_app(tmp_path / "days.sqlite3", clock=clock)


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


def view(client, day):
    response = client.get(f"{BASE}/days/{day}")
    assert response.status_code == 200, response.text
    return response.json()


def shown_keys(client, day):
    return [r["ritual_key"] for r in view(client, day)["rituals"]]


def tick(client, day, key):
    return client.post(f"{BASE}/days/{day}/rituals/{key}/toggle")


def log_history(app, day, keys):
    """Write ticks directly, bypassing the edit window, to set up streak history."""
    conn = app.state.conn
    with conn:
        for key in keys:
            conn.execute(
                "INSERT INTO ritual_logs (profile_id, log_date, ritual_key, done_at) "
                "VALUES (1, ?, ?, '2026-01-01T00:00:00+05:30')",
                (day, key),
            )


def test_a_weekday_shows_only_the_daily_rituals(client):
    body = view(client, "2026-11-18")  # Wednesday
    assert [r["ritual_key"] for r in body["rituals"]] == DAILY
    assert body["market_day"] is True
    assert body["editable"] is True  # 4 days before today, inside the 7-day window


def test_saturday_adds_the_weekend_quest(client):
    keys = shown_keys(client, "2026-11-21")  # Saturday
    assert "opportunity_hunting" in keys
    assert "log_audit" not in keys


@pytest.mark.parametrize("day", ["2026-11-27", "2026-11-30"])
def test_monthly_review_shows_on_the_last_two_market_days(client, day):
    assert "log_audit" in shown_keys(client, day)


def test_monthly_review_is_hidden_one_day_earlier(client):
    assert "log_audit" not in shown_keys(client, "2026-11-26")


def test_the_last_seven_days_are_editable_and_older_days_are_not(client, clock):
    # Today is 2026-11-22, so the window is 2026-11-16 .. 2026-11-22.
    assert view(client, "2026-11-22")["editable"] is True
    assert view(client, "2026-11-16")["editable"] is True
    assert view(client, "2026-11-15")["editable"] is False
    clock.move_to("2026-11-23")
    assert view(client, "2026-11-17")["editable"] is True
    assert view(client, "2026-11-16")["editable"] is False


def test_ticking_today_updates_the_day(client):
    response = tick(client, "2026-11-22", "webinar")
    assert response.status_code == 200
    body = response.json()
    assert next(r for r in body["rituals"] if r["ritual_key"] == "webinar")["done"] is True
    assert body["daily_done"] == 1


def test_ticking_twice_unticks_and_both_are_logged(client, app):
    tick(client, "2026-11-22", "webinar")
    body = tick(client, "2026-11-22", "webinar").json()
    assert body["daily_done"] == 0
    types = [
        row["event_type"]
        for row in app.state.conn.execute(
            "SELECT event_type FROM ritual_events WHERE ritual_key = 'webinar' "
            "AND event_type IN ('tick', 'untick') ORDER BY id"
        ).fetchall()
    ]
    assert types == ["tick", "untick"]


def test_a_tick_event_carries_the_rules_version(client, app):
    tick(client, "2026-11-22", "webinar")
    row = app.state.conn.execute(
        "SELECT rules_version, payload FROM ritual_events WHERE event_type = 'tick'"
    ).fetchone()
    assert row["rules_version"] == 1
    assert json.loads(row["payload"]) == {}


def test_a_past_day_inside_the_window_can_be_corrected(client, clock):
    clock.move_to("2026-11-23")
    body = tick(client, "2026-11-17", "webinar").json()  # oldest day in the window
    assert next(r for r in body["rituals"] if r["ritual_key"] == "webinar")["done"] is True
    assert body["daily_done"] == 1


def test_days_older_than_the_window_are_read_only(client, clock):
    clock.move_to("2026-11-23")
    response = tick(client, "2026-11-16", "webinar")
    assert response.status_code == 400
    assert "last 7 days" in response.json()["detail"]


def test_future_days_cannot_be_ticked(client):
    response = tick(client, "2026-11-23", "webinar")
    assert response.status_code == 400
    assert "future" in response.json()["detail"]


def test_a_ritual_not_shown_that_day_cannot_be_ticked(client, clock):
    clock.move_to("2026-11-18")  # Wednesday: no weekend quest
    response = tick(client, "2026-11-18", "opportunity_hunting")
    assert response.status_code == 404


def test_weekend_quest_does_not_count_towards_the_daily_total(client, clock):
    clock.move_to("2026-11-21")  # Saturday
    body = tick(client, "2026-11-21", "opportunity_hunting").json()
    assert body["daily_done"] == 0
    assert next(r for r in body["rituals"] if r["ritual_key"] == "opportunity_hunting")["done"] is True


def test_monthly_review_can_be_ticked_on_its_day(client, clock):
    clock.move_to("2026-11-30")
    response = tick(client, "2026-11-30", "log_audit")
    assert response.status_code == 200


def test_unknown_profile_is_not_found(client):
    assert client.get("/api/v1/profiles/nobody/days/2026-11-22").status_code == 404


def test_invalid_day_is_rejected(client):
    assert client.get(f"{BASE}/days/2026-02-30").status_code == 422


def test_streak_skips_weekends_and_counts_back_to_the_first_short_day(client, app):
    # Today (Sunday) has no ticks yet, so it does not break the streak.
    log_history(app, "2026-11-20", DAILY[:4])  # Friday: 4 daily
    log_history(app, "2026-11-19", DAILY[:4])  # Thursday: 4 daily
    log_history(app, "2026-11-18", DAILY[:4])  # Wednesday: 4 daily
    log_history(app, "2026-11-17", DAILY[:2])  # Tuesday: only 2, breaks the streak
    assert view(client, "2026-11-22")["streak"] == 3


def test_today_counts_towards_the_streak_once_it_qualifies(client, app, clock):
    clock.move_to("2026-11-23")  # Monday: a market day
    log_history(app, "2026-11-20", DAILY[:4])  # Friday
    assert view(client, "2026-11-23")["streak"] == 1
    for key in DAILY[:4]:
        tick(client, "2026-11-23", key)
    assert view(client, "2026-11-23")["streak"] == 2


def test_no_history_means_no_streak(client):
    assert view(client, "2026-11-22")["streak"] == 0


def test_a_ritual_retired_later_still_shows_on_earlier_days(client, clock):
    tick(client, "2026-11-22", "webinar")
    clock.move_to("2026-11-23")
    client.delete(f"{BASE}/rituals/webinar")
    assert "webinar" in shown_keys(client, "2026-11-22")
    assert "webinar" not in shown_keys(client, "2026-11-23")
    earlier = next(r for r in view(client, "2026-11-22")["rituals"] if r["ritual_key"] == "webinar")
    assert earlier["done"] is True
