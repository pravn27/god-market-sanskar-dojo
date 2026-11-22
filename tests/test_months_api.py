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
    return create_app(tmp_path / "months.sqlite3", clock=clock)


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


def month(client, label):
    response = client.get(f"{BASE}/months/{label}")
    assert response.status_code == 200, response.text
    return response.json()


def by_date(body, day):
    return next(d for d in body["days"] if d["date"] == day)


def log_history(app, day, keys):
    conn = app.state.conn
    with conn:
        for key in keys:
            conn.execute(
                "INSERT INTO ritual_logs (profile_id, log_date, ritual_key, done_at) "
                "VALUES (1, ?, ?, '2026-01-01T00:00:00+05:30')",
                (day, key),
            )


def test_a_month_lists_every_day(client):
    body = month(client, "2026-11")
    assert body["month"] == "2026-11"
    assert len(body["days"]) == 30
    assert body["days"][0]["date"] == "2026-11-01"
    assert body["days"][-1]["date"] == "2026-11-30"


def test_weekends_are_not_market_days(client):
    body = month(client, "2026-11")
    assert by_date(body, "2026-11-01")["market_day"] is False  # Sunday
    assert by_date(body, "2026-11-02")["market_day"] is True  # Monday


def test_days_after_today_are_future_and_not_editable(client):
    body = month(client, "2026-11")
    assert by_date(body, "2026-11-22")["editable"] is True
    assert by_date(body, "2026-11-22")["future"] is False
    assert by_date(body, "2026-11-23")["future"] is True


def test_only_the_last_seven_days_are_editable_in_the_month(client):
    body = month(client, "2026-11")
    assert by_date(body, "2026-11-16")["editable"] is True
    assert by_date(body, "2026-11-15")["editable"] is False


def test_daily_totals_exclude_the_weekend_quest(client):
    body = month(client, "2026-11")
    saturday = by_date(body, "2026-11-21")
    assert saturday["daily_total"] == 6
    assert saturday["shown_total"] == 7  # plus the weekend quest


def test_monthly_review_shows_on_the_last_two_market_days(client):
    body = month(client, "2026-11")
    assert by_date(body, "2026-11-26")["shown_total"] == 6
    assert by_date(body, "2026-11-27")["shown_total"] == 7
    assert by_date(body, "2026-11-30")["shown_total"] == 7


def test_on_track_and_full_days_are_counted_for_elapsed_market_days_only(app, client):
    log_history(app, "2026-11-16", DAILY[:4])  # on track
    log_history(app, "2026-11-17", DAILY)  # on track and full
    body = month(client, "2026-11")

    assert by_date(body, "2026-11-16")["on_track"] is True
    assert by_date(body, "2026-11-16")["full"] is False
    assert by_date(body, "2026-11-17")["full"] is True
    assert body["summary"] == {"market_days": 15, "on_track_days": 2, "full_days": 1}


def test_a_weekend_day_gets_the_same_colour_but_is_not_counted(app, client):
    log_history(app, "2026-11-14", DAILY)  # Saturday: every daily ritual done
    body = month(client, "2026-11")
    saturday = by_date(body, "2026-11-14")
    assert saturday["market_day"] is False
    assert saturday["full"] is True
    assert saturday["on_track"] is True
    assert body["summary"] == {"market_days": 15, "on_track_days": 0, "full_days": 0}


def test_a_day_with_too_few_dailies_is_not_on_track(app, client):
    log_history(app, "2026-11-16", DAILY[:3])
    body = month(client, "2026-11")
    assert by_date(body, "2026-11-16")["on_track"] is False
    assert body["summary"]["on_track_days"] == 0


def test_future_days_are_never_counted_even_with_ticks(app, client):
    log_history(app, "2026-11-25", DAILY)  # ticked in advance, which the API never allows
    body = month(client, "2026-11")
    assert body["summary"]["on_track_days"] == 0
    assert body["summary"]["full_days"] == 0


def test_navigation_stops_at_the_first_tracked_month_and_the_current_month(client):
    current = month(client, "2026-11")
    assert current["next_month"] is None
    assert current["prev_month"] == "2026-10"

    first = month(client, "2026-01")
    assert first["prev_month"] is None
    assert first["next_month"] == "2026-02"


def test_navigation_crosses_the_year_boundary(client, clock):
    clock.move_to("2027-02-10")
    body = month(client, "2027-01")
    assert body["prev_month"] == "2026-12"
    assert body["next_month"] == "2027-02"


@pytest.mark.parametrize("label", ["2026-13", "2026-00", "26-11", "2026-1", "november"])
def test_invalid_month_is_rejected(client, label):
    response = client.get(f"{BASE}/months/{label}")
    assert response.status_code == 422


def test_a_slash_in_the_month_does_not_match_the_route(client):
    assert client.get(f"{BASE}/months/2026/11").status_code == 404


def test_unknown_profile_is_not_found(client):
    assert client.get("/api/v1/profiles/nobody/months/2026-11").status_code == 404


def growth(client):
    response = client.get(f"{BASE}/growth")
    assert response.status_code == 200, response.text
    return response.json()["months"]


def test_growth_lists_every_month_from_the_tracker_start_to_now(client):
    months = growth(client)
    assert [m["month"] for m in months] == [f"2026-{n:02d}" for n in range(1, 12)]


def test_growth_counts_on_track_days_per_month(app, client):
    log_history(app, "2026-11-16", DAILY[:4])  # on track
    log_history(app, "2026-11-17", DAILY)  # on track and full
    by_month = {m["month"]: m for m in growth(client)}

    assert by_month["2026-11"] == {"month": "2026-11", "market_days": 15, "on_track_days": 2, "full_days": 1}
    # October is complete: 22 weekdays in October 2026, none ticked.
    assert by_month["2026-10"] == {"month": "2026-10", "market_days": 22, "on_track_days": 0, "full_days": 0}


def test_growth_never_counts_the_future(app, client, clock):
    clock.move_to("2026-11-03")
    log_history(app, "2026-11-25", DAILY)  # ticked in advance, never counted
    november = next(m for m in growth(client) if m["month"] == "2026-11")
    assert november["on_track_days"] == 0


def test_a_ritual_retired_later_still_counts_on_its_past_days(app, client, clock):
    log_history(app, "2026-11-16", DAILY[:4])
    clock.move_to("2026-11-23")
    client.delete(f"{BASE}/rituals/webinar")
    body = month(client, "2026-11")
    assert by_date(body, "2026-11-16")["on_track"] is True
    assert by_date(body, "2026-11-16")["daily_total"] == 6
