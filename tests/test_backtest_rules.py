"""Calculations and validation rules for backtest logs (see docs/specifications/backtest-log.md)."""

import pytest
from pydantic import ValidationError

from sanskar_dojo_api.backtests import calculate
from backtest_payloads import equity_buy, futures, options, without
from sanskar_dojo_api.models import BacktestFields


# ---- Calculations ------------------------------------------------------------


def test_equity_buy_results():
    log = BacktestFields(**equity_buy()).model_dump()
    result = calculate(log)
    assert result["risk_per_unit"] == 100
    assert result["risk_taken"] == 2000
    assert result["rr_t1"] == 3.0
    assert result["points"] == 150
    assert result["pnl"] == 3000
    assert result["pct"] == 3.8
    assert result["roi"] == 1.5
    assert result["holding_days"] == 2
    assert result["pnl_category"] == "win"


def test_sell_points_are_positive_when_price_falls():
    payload = equity_buy(
        side="sell", entry_price=24000, stop_loss=24100, target_1=23700,
        exit_price=23800, quantity=150, lots=None,
    )
    log = BacktestFields(**payload).model_dump()
    result = calculate(log)
    assert result["points"] == 200
    assert result["pnl"] == 30000
    assert result["pnl_category"] == "win"


def test_buy_that_exits_below_entry_is_a_loss():
    log = BacktestFields(**equity_buy(exit_price=3900)).model_dump()
    result = calculate(log)
    assert result["points"] == -50
    assert result["pnl_category"] == "loss"


def test_exit_at_entry_is_breakeven():
    log = BacktestFields(**equity_buy(exit_price=3950)).model_dump()
    assert calculate(log)["pnl_category"] == "breakeven"


def test_futures_quantity_is_lots_times_lot_size():
    log = BacktestFields(**futures()).model_dump()
    assert log["quantity"] == 150
    result = calculate(log)
    assert result["points"] == 250
    assert result["pnl"] == 37500
    assert result["roi"] == 12.5


def test_option_results_use_premium_points():
    log = BacktestFields(**options()).model_dump()
    result = calculate(log)
    assert log["quantity"] == 75
    assert result["rr_t1"] == 3.0
    assert result["points"] == 80
    assert result["pnl"] == 6000


def test_target_2_gives_its_own_reward_to_risk():
    log = BacktestFields(**equity_buy(target_2=4400)).model_dump()
    result = calculate(log)
    assert result["reward_t2"] == 450
    assert result["rr_t2"] == 4.5


# ---- Segment rules -----------------------------------------------------------


def test_equity_needs_quantity():
    with pytest.raises(ValidationError, match="equity needs quantity"):
        BacktestFields(**equity_buy(quantity=None))


@pytest.mark.parametrize("extra", [{"lot_size": 75}, {"lots": 2}, {"expiry_date": "2026-11-26"}])
def test_equity_rejects_fno_fields(extra):
    with pytest.raises(ValidationError, match="equity does not use"):
        BacktestFields(**equity_buy(**extra))


def test_futures_needs_expiry_and_lots():
    with pytest.raises(ValidationError, match="futures needs expiry_date, lot_size and lots"):
        BacktestFields(**futures(expiry_date=None))


def test_futures_rejects_option_fields():
    with pytest.raises(ValidationError, match="futures does not use: option_type"):
        BacktestFields(**futures(option_type="CE"))


def test_options_need_option_type_and_strike():
    with pytest.raises(ValidationError, match="options need option_type"):
        BacktestFields(**options(strike=None))


def test_fno_quantity_must_match_lots_times_lot_size():
    with pytest.raises(ValidationError, match="quantity must equal lots x lot_size"):
        BacktestFields(**futures(quantity=100))


def test_fno_quantity_may_be_left_out():
    log = BacktestFields(**futures(quantity=None))
    assert log.quantity == 150


# ---- Price rules -------------------------------------------------------------


def test_buy_stop_above_entry_is_refused():
    with pytest.raises(ValidationError, match="for a buy, stop loss must be below entry"):
        BacktestFields(**equity_buy(stop_loss=4000))


def test_sell_stop_below_entry_is_refused():
    with pytest.raises(ValidationError, match="for a sell, stop loss must be above entry"):
        BacktestFields(**equity_buy(side="sell", entry_price=24000, stop_loss=23900, target_1=23700,
                                    quantity=150, lots=None))


def test_target_2_must_lie_beyond_target_1():
    with pytest.raises(ValidationError, match="target 2 must lie beyond target 1"):
        BacktestFields(**equity_buy(target_2=4200))


def test_rr_below_one_to_three_is_refused():
    with pytest.raises(ValidationError, match=r"R:R is 2\.00; the minimum is 1:3"):
        BacktestFields(**equity_buy(target_1=4150))


def test_rr_of_exactly_one_to_three_is_accepted():
    BacktestFields(**equity_buy(target_1=4250))  # reward 300 over risk 100


# ---- Date and time rules -----------------------------------------------------


def test_exit_before_entry_is_refused():
    with pytest.raises(ValidationError, match="exit_date must not be before entry_date"):
        BacktestFields(**equity_buy(exit_date="2026-11-17"))


def test_same_day_exit_time_before_entry_time_is_refused():
    with pytest.raises(ValidationError, match="exit_time must not be before entry_time"):
        BacktestFields(**equity_buy(exit_date="2026-11-18", entry_time="10:30", exit_time="10:15"))


def test_times_are_checked_only_on_the_same_day():
    BacktestFields(**equity_buy(entry_time="15:20", exit_time="09:15"))


def test_invalid_clock_time_is_refused():
    with pytest.raises(ValidationError, match="entry_time must be HH:MM"):
        BacktestFields(**equity_buy(entry_time="25:00"))


# ---- Text and checklist rules ------------------------------------------------


def test_blank_entry_criteria_is_refused():
    with pytest.raises(ValidationError, match="entry_criteria must not be blank"):
        BacktestFields(**equity_buy(entry_criteria="   "))


def test_blank_lesson_is_refused():
    with pytest.raises(ValidationError, match="lesson must not be blank"):
        BacktestFields(**equity_buy(lesson=""))


def test_optional_text_is_trimmed_and_blank_becomes_none():
    log = BacktestFields(**equity_buy(pattern="  ", observations="  Clean move  "))
    assert log.pattern is None
    assert log.observations == "Clean move"


def test_duplicate_checklist_item_is_refused():
    checks = [{"item_id": "weapon_candle", "ticked": True}, {"item_id": "weapon_candle", "ticked": False}]
    with pytest.raises(ValidationError, match="each checklist item may appear only once"):
        BacktestFields(**equity_buy(checks=checks))


def test_unknown_enum_values_are_refused():
    with pytest.raises(ValidationError):
        BacktestFields(**equity_buy(setup_type="head_and_shoulders"))
    with pytest.raises(ValidationError):
        BacktestFields(**equity_buy(exit_reason="hope"))


def test_stored_exit_reason_list_matches_the_trade_exit_vocabulary():
    for reason in ("planned_target", "planned_stop", "trail_stop", "view_invalidated", "early_book", "other"):
        BacktestFields(**equity_buy(exit_reason=reason))


def test_entry_criteria_is_required():
    payload = without(equity_buy(), "entry_criteria")
    with pytest.raises(ValidationError, match="entry_criteria"):
        BacktestFields(**payload)


def test_optional_fields_may_be_left_out():
    payload = without(equity_buy(), "exit_criteria", "spot_price", "margin_used", "tide_tf", "chart_link")
    log = BacktestFields(**payload)
    assert log.exit_criteria is None and log.chart_link is None
