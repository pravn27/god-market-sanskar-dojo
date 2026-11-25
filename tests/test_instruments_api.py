"""Routes for the instrument list: create, list, edit and remove."""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from sanskar_dojo_api.app import create_app

KOLKATA = ZoneInfo("Asia/Kolkata")
BASE = "/api/v1/profiles/praveen/instruments"


class Clock:
    def __init__(self, day: str) -> None:
        self.now = datetime.fromisoformat(f"{day}T09:00:00").replace(tzinfo=KOLKATA)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def app(tmp_path):
    return create_app(tmp_path / "instruments.sqlite3", clock=Clock("2026-11-25"))


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


def add(client, symbol, lot_size=None):
    response = client.post(BASE, json={"symbol": symbol, "lot_size": lot_size})
    assert response.status_code == 201, response.text
    return response.json()


def test_create_returns_the_stored_instrument_in_upper_case(client):
    body = add(client, "  nifty  ", 75)
    assert body["symbol"] == "NIFTY"
    assert body["lot_size"] == 75
    assert isinstance(body["id"], int)
    assert body["created_at"] == "2026-11-25T09:00:00+05:30"


def test_equity_needs_no_lot_size(client):
    assert add(client, "RELIANCE")["lot_size"] is None


def test_list_is_sorted_by_symbol(client):
    add(client, "NIFTY", 75)
    add(client, "BANKNIFTY", 30)
    add(client, "RELIANCE")
    symbols = [row["symbol"] for row in client.get(BASE).json()["instruments"]]
    assert symbols == ["BANKNIFTY", "NIFTY", "RELIANCE"]


def test_a_symbol_already_in_the_list_is_refused_whatever_its_case(client):
    add(client, "NIFTY", 75)
    response = client.post(BASE, json={"symbol": "nifty", "lot_size": 50})
    assert response.status_code == 409
    assert response.json() == {"detail": "NIFTY is already in the list."}


def test_symbols_may_contain_the_usual_market_punctuation(client):
    assert add(client, "m&m")["symbol"] == "M&M"
    assert add(client, "bajaj-auto")["symbol"] == "BAJAJ-AUTO"
    assert add(client, "nifty  50")["symbol"] == "NIFTY 50"


@pytest.mark.parametrize("symbol", ["", "   ", "NIFTY/50", "<script>", "-LEADING"])
def test_a_bad_symbol_is_rejected(client, symbol):
    assert client.post(BASE, json={"symbol": symbol}).status_code == 422


@pytest.mark.parametrize("lot_size", [0, -5])
def test_a_lot_size_must_be_positive(client, lot_size):
    assert client.post(BASE, json={"symbol": "NIFTY", "lot_size": lot_size}).status_code == 422


def test_edit_changes_the_symbol_and_lot_size(client):
    created = add(client, "NIFTY", 75)
    response = client.put(f"{BASE}/{created['id']}", json={"symbol": "NIFTY 50", "lot_size": 25})
    assert response.status_code == 200
    assert response.json()["symbol"] == "NIFTY 50"
    assert response.json()["lot_size"] == 25


def test_edit_cannot_take_another_instruments_symbol(client):
    add(client, "NIFTY", 75)
    other = add(client, "BANKNIFTY", 30)
    response = client.put(f"{BASE}/{other['id']}", json={"symbol": "nifty", "lot_size": 30})
    assert response.status_code == 409


def test_editing_an_instrument_keeps_its_own_symbol(client):
    created = add(client, "NIFTY", 75)
    response = client.put(f"{BASE}/{created['id']}", json={"symbol": "NIFTY", "lot_size": 50})
    assert response.status_code == 200
    assert response.json()["lot_size"] == 50


def test_remove_deletes_the_instrument(client):
    created = add(client, "NIFTY", 75)
    assert client.delete(f"{BASE}/{created['id']}").json() == {"deleted": created["id"]}
    assert client.get(BASE).json()["instruments"] == []


def test_unknown_instrument_ids_are_not_found(client):
    assert client.put(f"{BASE}/999", json={"symbol": "NIFTY"}).status_code == 404
    response = client.delete(f"{BASE}/999")
    assert response.status_code == 404
    assert response.json() == {"detail": "No instrument with id 999"}


def test_an_unknown_profile_is_not_found(client):
    assert client.get("/api/v1/profiles/nobody/instruments").status_code == 404


def test_the_same_symbol_can_exist_in_another_profile(app, client):
    conn = app.state.conn
    conn.execute("INSERT INTO profiles (slug, display_name, created_at) VALUES ('asha', 'Asha', '2026-11-01')")
    add(client, "NIFTY", 75)
    other_id = conn.execute("SELECT id FROM profiles WHERE slug = 'asha'").fetchone()[0]
    conn.execute(
        "INSERT INTO instruments (profile_id, symbol, lot_size, created_at, updated_at) "
        "VALUES (?, 'NIFTY', 50, '2026-11-25', '2026-11-25')",
        (other_id,),
    )
    conn.commit()
    assert [row["symbol"] for row in client.get(BASE).json()["instruments"]] == ["NIFTY"]
