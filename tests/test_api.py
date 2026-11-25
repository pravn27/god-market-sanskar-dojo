import pytest
from fastapi.testclient import TestClient

from sanskar_dojo_api.app import create_app


@pytest.fixture
def client(tmp_path):
    app = create_app(tmp_path / "api.sqlite3")
    with TestClient(app) as test_client:
        yield test_client


def test_health_reports_schema_and_profile(client):
    body = client.get("/api/v1/health").json()
    assert body["status"] == "ok"
    assert body["schema_version"] == 3
    assert body["profile"] == "praveen"


def test_profiles_lists_praveen(client):
    profiles = client.get("/api/v1/profiles").json()
    assert [p["slug"] for p in profiles] == ["praveen"]
    assert profiles[0]["display_name"] == "Praveen"


def test_rituals_are_read_from_the_database_in_order(client):
    body = client.get("/api/v1/profiles/praveen/rituals", params={"as_of": "2026-11-22"}).json()
    assert body["profile"] == "praveen"
    assert body["as_of"] == "2026-11-22"
    keys = [r["ritual_key"] for r in body["rituals"]]
    assert keys == [
        "market_overview",
        "backtesting",
        "geo_revision",
        "webinar",
        "preparation",
        "buddy_connect",
        "opportunity_hunting",
        "log_audit",
    ]
    by_key = {r["ritual_key"]: r for r in body["rituals"]}
    assert by_key["market_overview"]["minutes"] == 45
    assert by_key["opportunity_hunting"]["cadence"] == "weekend"
    assert by_key["opportunity_hunting"]["counts_for_streak"] is False
    assert by_key["log_audit"]["monthly_last_market_days"] == 2


def test_no_rituals_before_the_tracker_start(client):
    body = client.get("/api/v1/profiles/praveen/rituals", params={"as_of": "2025-12-31"}).json()
    assert body["rituals"] == []


def test_unknown_profile_is_not_found(client):
    response = client.get("/api/v1/profiles/nobody/rituals", params={"as_of": "2026-11-22"})
    assert response.status_code == 404


def test_invalid_date_is_rejected(client):
    response = client.get("/api/v1/profiles/praveen/rituals", params={"as_of": "2026-13-01"})
    assert response.status_code == 422


def test_malformed_date_is_rejected_by_the_pattern(client):
    response = client.get("/api/v1/profiles/praveen/rituals", params={"as_of": "22-11-2026"})
    assert response.status_code == 422
