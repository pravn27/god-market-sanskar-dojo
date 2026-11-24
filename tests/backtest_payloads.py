"""Shared payload builders for backtest tests. Valid by default; tests override fields."""


def equity_buy(**overrides):
    base = {
        "segment": "equity",
        "side": "buy",
        "setup_family": "swing",
        "setup_type": "rd_bullish",
        "instrument": "RELIANCE",
        "quantity": 20,
        "entry_date": "2026-11-18",
        "entry_price": 3950,
        "entry_criteria": "Weapon candle closed above the 5 EMA",
        "stop_loss": 3850,
        "target_1": 4250,
        "exit_date": "2026-11-20",
        "exit_price": 4100,
        "exit_reason": "planned_target",
        "capital": 200000,
        "lesson": "Waited for the close",
    }
    base.update(overrides)
    return base


def futures(**overrides):
    base = equity_buy(
        segment="futures",
        instrument="NIFTY",
        quantity=None,
        expiry_date="2026-11-26",
        lot_size=75,
        lots=2,
        entry_price=24000,
        stop_loss=23900,
        target_1=24300,
        exit_price=24250,
        capital=300000,
    )
    base.update(overrides)
    return base


def options(**overrides):
    base = futures(
        segment="options",
        option_type="CE",
        strike=24000,
        lots=1,
        entry_price=150,
        stop_loss=120,
        target_1=240,
        exit_price=230,
    )
    base.update(overrides)
    return base


def without(payload, *keys):
    return {key: value for key, value in payload.items() if key not in keys}
