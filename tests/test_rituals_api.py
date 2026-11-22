import json
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from sanskar_dojo_api.app import create_app

KOLKATA = ZoneInfo("Asia/Kolkata")
BASE = "/api/v1/profiles/praveen/rituals"


class Clock:
    def __init__(self, day: str) -> None:
        self.now = datetime.fromisoformat(f"{day}T09:00:00").replace(tzinfo=KOLKATA)

    def __call__(self) -> datetime:
        return self.now

    def move_to(self, day: str) -> None:
        self.now = datetime.fromisoformat(f"{day}T09:00:00").replace(tzinfo=KOLKATA)


@pytest.fixture
def clock():
    return Clock("2026-11-22")


@pytest.fixture
def app(tmp_path, clock):
    return create_app(tmp_path / "api.sqlite3", clock=clock)


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


def new_ritual(**overrides):
    body = {"label": "Chart review", "minutes": 20, "cadence": "daily"}
    body.update(overrides)
    return body


def active_keys(client, day):
    body = client.get(BASE, params={"as_of": day}).json()
    return [r["ritual_key"] for r in body["rituals"]]


def version_rows(app, key):
    rows = app.state.conn.execute(
        "SELECT label, minutes, valid_from, valid_to FROM ritual_defs WHERE ritual_key = ? ORDER BY id",
        (key,),
    ).fetchall()
    return [dict(row) for row in rows]


def events(app, key):
    rows = app.state.conn.execute(
        "SELECT event_type, payload FROM ritual_events WHERE ritual_key = ? ORDER BY id", (key,)
    ).fetchall()
    return [(row["event_type"], json.loads(row["payload"])) for row in rows]


def test_create_adds_a_ritual_from_today_with_a_key_from_the_label(client, app):
    response = client.post(BASE, json=new_ritual(label="Chart Review!"))
    assert response.status_code == 201
    created = response.json()
    assert created["ritual_key"] == "chart_review"
    assert created["valid_from"] == "2026-11-22"
    assert created["valid_to"] is None
    assert created["counts_for_streak"] is True
    assert active_keys(client, "2026-11-22")[-1] == "chart_review"
    assert "chart_review" not in active_keys(client, "2026-11-21")  # never backdated


def test_create_appends_at_the_end_of_the_order(client):
    client.post(BASE, json=new_ritual(label="First extra"))
    client.post(BASE, json=new_ritual(label="Second extra"))
    keys = active_keys(client, "2026-11-22")
    assert keys[-2:] == ["first_extra", "second_extra"]


def test_create_reuses_no_key_even_after_retiring(client, clock):
    client.post(BASE, json=new_ritual(label="Chart review"))
    clock.move_to("2026-11-23")
    client.delete(f"{BASE}/chart_review")
    response = client.post(BASE, json=new_ritual(label="Chart review"))
    assert response.status_code == 201
    assert response.json()["ritual_key"] == "chart_review_2"


def test_create_rejects_a_duplicate_label_case_insensitively(client):
    response = client.post(BASE, json=new_ritual(label="daily BACKTESTING"))
    assert response.status_code == 409
    assert "already active" in response.json()["detail"]


def test_create_rejects_a_blank_label(client):
    assert client.post(BASE, json=new_ritual(label="   ")).status_code == 422


@pytest.mark.parametrize("minutes", [0, 241])
def test_create_rejects_minutes_outside_the_range(client, minutes):
    assert client.post(BASE, json=new_ritual(minutes=minutes)).status_code == 422


def test_weekdays_cadence_needs_days_and_sorts_them(client):
    assert client.post(BASE, json=new_ritual(cadence="weekdays")).status_code == 422
    response = client.post(BASE, json=new_ritual(cadence="weekdays", weekdays=[5, 1, 5]))
    assert response.status_code == 201
    assert response.json()["weekdays"] == [1, 5]


def test_weekdays_out_of_range_are_rejected(client):
    body = new_ritual(cadence="weekdays", weekdays=[7])
    assert client.post(BASE, json=body).status_code == 422


def test_weekdays_on_a_daily_ritual_are_rejected(client):
    assert client.post(BASE, json=new_ritual(weekdays=[1])).status_code == 422


def test_monthly_cadence_needs_its_count(client):
    body = new_ritual(cadence="monthly_last_market_days")
    assert client.post(BASE, json=body).status_code == 422
    body["monthly_last_market_days"] = 2
    response = client.post(BASE, json=body)
    assert response.status_code == 201
    assert response.json()["monthly_last_market_days"] == 2


def test_at_most_twelve_active_rituals(client):
    # The seed has 8 active rituals, so 4 more fit.
    for number in range(4):
        assert client.post(BASE, json=new_ritual(label=f"Extra {number}")).status_code == 201
    response = client.post(BASE, json=new_ritual(label="One too many"))
    assert response.status_code == 409
    assert "up to 12" in response.json()["detail"]


def test_unknown_profile_is_not_found(client):
    assert client.post("/api/v1/profiles/nobody/rituals", json=new_ritual()).status_code == 404


def test_update_on_a_later_day_keeps_the_past_version(client, app, clock):
    clock.move_to("2026-11-23")
    response = client.put(
        f"{BASE}/market_overview",
        json=new_ritual(label="Daily Rituals on Market Overview", minutes=60),
    )
    assert response.status_code == 200
    assert response.json()["minutes"] == 60

    before = client.get(BASE, params={"as_of": "2026-11-22"}).json()["rituals"]
    after = client.get(BASE, params={"as_of": "2026-11-23"}).json()["rituals"]
    assert next(r for r in before if r["ritual_key"] == "market_overview")["minutes"] == 45
    assert next(r for r in after if r["ritual_key"] == "market_overview")["minutes"] == 60


def test_update_writes_a_new_version_and_closes_the_old_one(client, app, clock):
    clock.move_to("2026-11-23")
    client.put(f"{BASE}/market_overview", json=new_ritual(label="Market overview", minutes=60))
    versions = version_rows(app, "market_overview")
    assert len(versions) == 2
    assert versions[0]["valid_to"] == "2026-11-23"
    assert versions[1]["valid_from"] == "2026-11-23"
    assert versions[1]["valid_to"] is None


def test_second_edit_on_the_same_day_edits_in_place(client, app):
    label = "Daily Rituals on Market Overview"
    client.put(f"{BASE}/market_overview", json=new_ritual(label=label, minutes=50))
    client.put(f"{BASE}/market_overview", json=new_ritual(label=label, minutes=55))
    versions = version_rows(app, "market_overview")
    # The seed version (closed today) plus one version that was edited in place.
    assert len(versions) == 2
    assert versions[1]["minutes"] == 55
    assert versions[1]["valid_to"] is None
    assert client.get(BASE, params={"as_of": "2026-11-22"}).json()["rituals"][0]["minutes"] == 55


def test_update_keeps_the_key_and_the_display_order(client):
    client.put(f"{BASE}/webinar", json=new_ritual(label="Webinar (live)", minutes=30))
    rituals = client.get(BASE, params={"as_of": "2026-11-22"}).json()["rituals"]
    assert [r["ritual_key"] for r in rituals][:4] == [
        "market_overview",
        "backtesting",
        "geo_revision",
        "webinar",
    ]
    assert rituals[3]["label"] == "Webinar (live)"


def test_update_rejects_a_label_used_by_another_active_ritual(client):
    response = client.put(f"{BASE}/webinar", json=new_ritual(label="daily backtesting"))
    assert response.status_code == 409


def test_update_may_keep_its_own_label(client):
    response = client.put(f"{BASE}/webinar", json=new_ritual(label="webinar", minutes=25))
    assert response.status_code == 200


def test_update_unknown_ritual_is_not_found(client):
    assert client.put(f"{BASE}/nope", json=new_ritual()).status_code == 404


def test_retire_removes_the_ritual_from_the_day_onward(client, clock):
    clock.move_to("2026-11-25")
    response = client.delete(f"{BASE}/webinar")
    assert response.status_code == 200
    assert response.json()["retired_from"] == "2026-11-25"
    assert "webinar" in active_keys(client, "2026-11-24")
    assert "webinar" not in active_keys(client, "2026-11-25")


def test_retire_twice_is_not_found(client, clock):
    clock.move_to("2026-11-25")
    client.delete(f"{BASE}/webinar")
    assert client.delete(f"{BASE}/webinar").status_code == 404


def test_retired_ritual_cannot_be_edited(client, clock):
    clock.move_to("2026-11-25")
    client.delete(f"{BASE}/webinar")
    assert client.put(f"{BASE}/webinar", json=new_ritual(label="Webinar")).status_code == 404


def test_retire_on_the_day_it_was_created_is_rejected(client):
    client.post(BASE, json=new_ritual(label="Oops"))
    response = client.delete(f"{BASE}/oops")
    assert response.status_code == 409
    assert "started today" in response.json()["detail"]


def test_retired_key_leaves_no_active_row_behind(client, app, clock):
    clock.move_to("2026-11-25")
    client.delete(f"{BASE}/webinar")
    versions = version_rows(app, "webinar")
    assert len(versions) == 1
    assert versions[0]["valid_to"] == "2026-11-25"


def test_reorder_changes_the_display_order_from_today(client, clock):
    keys = active_keys(client, "2026-11-22")
    flipped = list(reversed(keys))
    response = client.post(f"{BASE}/reorder", json={"keys": flipped})
    assert response.status_code == 200
    assert [r["ritual_key"] for r in response.json()["rituals"]] == flipped
    assert active_keys(client, "2026-11-22") == flipped


def test_reorder_keeps_the_past_order(client, clock):
    keys = active_keys(client, "2026-11-22")
    clock.move_to("2026-11-23")
    client.post(f"{BASE}/reorder", json={"keys": list(reversed(keys))})
    assert active_keys(client, "2026-11-22") == keys


def test_reorder_must_list_every_active_ritual_once(client):
    keys = active_keys(client, "2026-11-22")
    assert client.post(f"{BASE}/reorder", json={"keys": keys[:-1]}).status_code == 422
    assert client.post(f"{BASE}/reorder", json={"keys": keys + ["webinar"]}).status_code == 422
    assert client.post(f"{BASE}/reorder", json={"keys": keys[:-1] + [keys[0]]}).status_code == 422


def test_every_change_is_written_to_the_event_log(client, app, clock):
    client.post(BASE, json=new_ritual(label="Chart review"))
    client.put(f"{BASE}/chart_review", json=new_ritual(label="Chart review", minutes=35))
    types = [event for event, _ in events(app, "chart_review")]
    assert types == ["def_created", "def_updated"]


def test_update_event_records_before_and_after(client, app):
    client.put(f"{BASE}/market_overview", json=new_ritual(label="Market overview", minutes=50))
    (event_type, payload), = events(app, "market_overview")[-1:]
    assert event_type == "def_updated"
    assert payload["before"]["minutes"] == 45
    assert payload["after"]["minutes"] == 50


def test_retire_event_records_the_last_day(client, app, clock):
    clock.move_to("2026-11-25")
    client.delete(f"{BASE}/webinar")
    (event_type, payload), = events(app, "webinar")[-1:]
    assert event_type == "def_archived"
    assert payload["last_day"] == "2026-11-25"


def test_event_log_still_rejects_edits(client, app):
    client.post(BASE, json=new_ritual(label="Chart review"))
    with pytest.raises(Exception, match="append-only"):
        app.state.conn.execute("UPDATE ritual_events SET event_type = 'x'")
