"""Routes for backtest logs: create, list, read, edit and delete."""

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient

from sanskar_dojo_api.app import create_app

from backtest_payloads import equity_buy, futures, options

KOLKATA = ZoneInfo("Asia/Kolkata")
BASE = "/api/v1/profiles/praveen/backtests"


class Clock:
    def __init__(self, day: str) -> None:
        self.now = datetime.fromisoformat(f"{day}T09:00:00").replace(tzinfo=KOLKATA)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def clock():
    return Clock("2026-11-22")


@pytest.fixture
def app(tmp_path, clock):
    return create_app(tmp_path / "backtests.sqlite3", clock=clock)


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client


def create(client, payload):
    response = client.post(BASE, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_create_equity_returns_the_log_with_calculated_fields(client):
    body = create(client, equity_buy(checks=[{"item_id": "weapon_candle", "ticked": True}]))
    assert body["segment"] == "equity"
    assert body["quantity"] == 20
    assert body["rr_t1"] == 3.0
    assert body["pnl"] == 3000
    assert body["pnl_category"] == "win"
    assert body["checks"] == [{"item_id": "weapon_candle", "ticked": True}]
    assert body["rules_version"] == 1
    assert body["created_at"] == body["updated_at"]


def test_create_futures_derives_quantity_from_lots(client):
    body = create(client, futures(lots=3))
    assert body["lots"] == 3
    assert body["lot_size"] == 75
    assert body["quantity"] == 225
    assert body["expiry_date"] == "2026-11-26"


def test_create_options_stores_the_contract(client):
    body = create(client, options())
    assert body["option_type"] == "CE"
    assert body["strike"] == 24000
    assert body["points"] == 80
    assert body["pnl"] == 6000


def test_invalid_log_is_refused_with_the_rule_message(client):
    response = client.post(BASE, json=equity_buy(target_1=4150))
    assert response.status_code == 422
    assert "R:R is 2.00; the minimum is 1:3" in response.text


def test_unknown_profile_is_not_found(client):
    response = client.get("/api/v1/profiles/nobody/backtests")
    assert response.status_code == 404


def test_list_is_newest_entry_first(client):
    create(client, equity_buy(entry_date="2026-11-10", exit_date="2026-11-12"))
    create(client, equity_buy(entry_date="2026-11-18", exit_date="2026-11-20"))
    dates = [log["entry_date"] for log in client.get(BASE).json()["backtests"]]
    assert dates == ["2026-11-18", "2026-11-10"]


def test_list_filters_by_segment_and_setup_type(client):
    create(client, equity_buy())
    create(client, futures())
    create(client, options())
    only_futures = client.get(f"{BASE}?segment=futures").json()["backtests"]
    assert [log["segment"] for log in only_futures] == ["futures"]

    doubles = client.get(f"{BASE}?setup_type=double_top").json()["backtests"]
    assert doubles == []


def test_list_filters_by_outcome_and_date_range(client):
    create(client, equity_buy(entry_date="2026-11-10", exit_date="2026-11-12"))
    create(client, equity_buy(entry_date="2026-11-18", exit_date="2026-11-20", exit_price=3900))
    wins = client.get(f"{BASE}?outcome=win").json()["backtests"]
    assert [log["entry_date"] for log in wins] == ["2026-11-10"]

    in_range = client.get(f"{BASE}?from=2026-11-15&to=2026-11-30").json()["backtests"]
    assert [log["entry_date"] for log in in_range] == ["2026-11-18"]


def test_get_returns_one_log_and_unknown_id_is_not_found(client):
    created = create(client, equity_buy())
    assert client.get(f"{BASE}/{created['id']}").json()["instrument"] == "RELIANCE"
    missing = client.get(f"{BASE}/9999")
    assert missing.status_code == 404
    assert "9999" in missing.json()["detail"]


def test_update_replaces_fields_and_checks(app, client, clock):
    created = create(client, equity_buy(checks=[{"item_id": "weapon_candle", "ticked": True}]))
    clock.now = datetime.fromisoformat("2026-11-23T10:00:00").replace(tzinfo=KOLKATA)

    response = client.put(
        f"{BASE}/{created['id']}",
        json=equity_buy(exit_price=4200, lesson="Held to target 1",
                        checks=[{"item_id": "rsi_40_60", "ticked": False}]),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["exit_price"] == 4200
    assert body["lesson"] == "Held to target 1"
    assert body["checks"] == [{"item_id": "rsi_40_60", "ticked": False}]
    assert body["created_at"] != body["updated_at"]


def test_update_of_unknown_id_is_not_found(client):
    assert client.put(f"{BASE}/9999", json=equity_buy()).status_code == 404


def test_delete_removes_the_log_and_its_checks(app, client):
    created = create(client, equity_buy(checks=[{"item_id": "weapon_candle", "ticked": True}]))
    response = client.delete(f"{BASE}/{created['id']}")
    assert response.status_code == 200
    assert response.json() == {"deleted": created["id"]}
    assert client.get(f"{BASE}/{created['id']}").status_code == 404

    conn = app.state.conn
    assert conn.execute("SELECT COUNT(*) FROM backtest_log_checks").fetchone()[0] == 0


def test_delete_of_unknown_id_is_not_found(client):
    assert client.delete(f"{BASE}/9999").status_code == 404


def test_migration_two_creates_the_backtest_tables(app, client):
    assert client.get("/api/v1/health").json()["schema_version"] == 3
    names = {
        row["name"]
        for row in app.state.conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
    }
    assert {"backtest_logs", "backtest_log_checks"} <= names


def test_database_rejects_an_options_row_without_a_strike(app, client):
    conn = app.state.conn
    with pytest.raises(Exception, match="CHECK constraint failed"):
        conn.execute(
            "INSERT INTO backtest_logs (profile_id, segment, side, setup_family, setup_type, instrument, "
            "option_type, quantity, entry_date, entry_price, entry_criteria, stop_loss, target_1, exit_date, "
            "exit_price, exit_reason, capital, lesson, rules_version, created_at, updated_at) "
            "VALUES (1, 'options', 'buy', 'swing', 'rd_bullish', 'NIFTY', 'CE', 75, '2026-11-18', 150, 'x', "
            "120, 240, '2026-11-20', 230, 'planned_target', 300000, 'y', 1, 'now', 'now')"
        )
