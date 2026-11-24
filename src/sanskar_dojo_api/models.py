"""Request contracts for ritual definitions."""

from __future__ import annotations

import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from .backtests import MAX_CHECKS, MIN_RR, rr_for_minimum

Cadence = Literal["daily", "weekdays", "weekend", "monthly_last_market_days"]


class RitualFields(BaseModel):
    """The editable fields of a ritual. Changes always apply from today."""

    label: str = Field(min_length=1, max_length=120)
    minutes: int = Field(ge=1, le=240)
    cadence: Cadence
    # Weekdays for the `weekdays` cadence: 0 = Sunday ... 6 = Saturday.
    weekdays: list[int] | None = None
    # Last N market days of the month, for the `monthly_last_market_days` cadence.
    monthly_last_market_days: int | None = Field(default=None, ge=1, le=5)
    counts_for_streak: bool = True

    @field_validator("label")
    @classmethod
    def label_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("label must not be blank")
        return cleaned

    @model_validator(mode="after")
    def cadence_fields_match(self) -> RitualFields:
        if self.cadence == "weekdays":
            if not self.weekdays:
                raise ValueError("the weekdays cadence needs at least one weekday")
            if any(day < 0 or day > 6 for day in self.weekdays):
                raise ValueError("weekdays must be between 0 (Sunday) and 6 (Saturday)")
            self.weekdays = sorted(set(self.weekdays))
        elif self.weekdays is not None:
            raise ValueError("weekdays only apply to the weekdays cadence")

        if self.cadence == "monthly_last_market_days":
            if self.monthly_last_market_days is None:
                raise ValueError("the monthly cadence needs monthly_last_market_days")
        elif self.monthly_last_market_days is not None:
            raise ValueError("monthly_last_market_days only applies to the monthly cadence")
        return self


class RitualReorder(BaseModel):
    """Every active ritual key, in the new display order."""

    keys: list[str] = Field(min_length=1)


# ---- Backtest logs -----------------------------------------------------------

Segment = Literal["equity", "futures", "options"]
Side = Literal["buy", "sell"]
SetupFamily = Literal["swing", "momentum"]
SetupType = Literal[
    "rd_bullish", "rd_bearish", "fbd", "double_top", "double_bottom", "third_wave", "other",
]
OptionType = Literal["CE", "PE"]
Timeframe = Literal["5min", "15min", "30min", "1hr", "4hr", "daily", "weekly", "monthly"]
ExitReason = Literal[
    "planned_target", "planned_stop", "trail_stop", "view_invalidated", "early_book", "other",
]

_TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_REQUIRED_TEXT = ("instrument", "entry_criteria", "lesson")
_OPTIONAL_TEXT = ("pattern", "exit_criteria", "observations", "chart_link")
_FNO_ONLY = ("expiry_date", "lot_size", "lots")
_OPTIONS_ONLY = ("option_type", "strike")


class BacktestCheck(BaseModel):
    """One checklist item and whether it was ticked."""

    item_id: str = Field(min_length=1, max_length=60)
    ticked: bool

    @field_validator("item_id")
    @classmethod
    def item_id_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("item_id must not be blank")
        return cleaned


class BacktestFields(BaseModel):
    """A backtest log as typed in. Segment decides which contract fields apply.

    Rules: see docs/specifications/backtest-log.md, section Validation.
    """

    segment: Segment
    side: Side
    setup_family: SetupFamily
    setup_type: SetupType
    pattern: str | None = Field(default=None, max_length=80)
    instrument: str = Field(max_length=40)
    option_type: OptionType | None = None
    strike: float | None = Field(default=None, gt=0)
    expiry_date: date | None = None
    lot_size: int | None = Field(default=None, gt=0)
    lots: int | None = Field(default=None, gt=0)
    # Equity: shares. F&O: derived as lots x lot size, and may be omitted.
    quantity: int | None = Field(default=None, gt=0)
    tide_tf: Timeframe | None = None
    wave_tf: Timeframe | None = None
    ripple_tf: Timeframe | None = None
    entry_date: date
    entry_time: str | None = None
    entry_price: float = Field(gt=0)
    entry_criteria: str = Field(max_length=500)
    stop_loss: float = Field(gt=0)
    target_1: float = Field(gt=0)
    target_2: float | None = Field(default=None, gt=0)
    exit_date: date
    exit_time: str | None = None
    exit_price: float = Field(gt=0)
    exit_reason: ExitReason
    exit_criteria: str | None = Field(default=None, max_length=500)
    capital: float = Field(gt=0)
    spot_price: float | None = Field(default=None, gt=0)
    margin_used: float | None = Field(default=None, gt=0)
    observations: str | None = Field(default=None, max_length=4000)
    chart_link: str | None = Field(default=None, max_length=500)
    lesson: str = Field(max_length=500)
    checks: list[BacktestCheck] = Field(default_factory=list, max_length=MAX_CHECKS)

    @model_validator(mode="after")
    def check_log(self) -> BacktestFields:
        self._normalise_text()
        self._normalise_times()
        self._check_contract()
        self._check_prices()
        self._check_dates()
        self._check_checks()
        return self

    def _normalise_text(self) -> None:
        for name in _REQUIRED_TEXT:
            cleaned = getattr(self, name).strip()
            if not cleaned:
                raise ValueError(f"{name} must not be blank")
            setattr(self, name, cleaned)
        for name in _OPTIONAL_TEXT:
            value = getattr(self, name)
            setattr(self, name, (value or "").strip() or None)

    def _normalise_times(self) -> None:
        for name in ("entry_time", "exit_time"):
            value = (getattr(self, name) or "").strip() or None
            if value is not None and not _TIME.match(value):
                raise ValueError(f"{name} must be HH:MM on a 24-hour clock")
            setattr(self, name, value)

    def _check_contract(self) -> None:
        if self.segment == "equity":
            if self.quantity is None:
                raise ValueError("equity needs quantity (shares)")
            _forbid(self, (*_FNO_ONLY, *_OPTIONS_ONLY), "equity")
            return

        if self.segment == "options":
            if self.option_type is None or self.strike is None:
                raise ValueError("options need option_type (CE or PE) and strike")
        else:
            _forbid(self, _OPTIONS_ONLY, "futures")

        if self.expiry_date is None or self.lot_size is None or self.lots is None:
            raise ValueError(f"{self.segment} needs expiry_date, lot_size and lots")
        expected = self.lots * self.lot_size
        if self.quantity is not None and self.quantity != expected:
            raise ValueError(f"quantity must equal lots x lot_size ({expected}) for {self.segment}")
        self.quantity = expected

    def _check_prices(self) -> None:
        entry, stop, target_1 = self.entry_price, self.stop_loss, self.target_1
        if self.side == "buy" and not (stop < entry < target_1):
            raise ValueError("for a buy, stop loss must be below entry and target 1 above entry")
        if self.side == "sell" and not (stop > entry > target_1):
            raise ValueError("for a sell, stop loss must be above entry and target 1 below entry")
        if self.target_2 is not None:
            beyond = self.target_2 > target_1 if self.side == "buy" else self.target_2 < target_1
            if not beyond:
                raise ValueError("target 2 must lie beyond target 1 in the trade's direction")
        rr = rr_for_minimum(self.side, entry, stop, target_1, self.target_2)
        if rr is None or rr < MIN_RR - 1e-9:
            shown = "none" if rr is None else f"{rr:.2f}"
            raise ValueError(f"R:R is {shown}; the minimum is 1:{MIN_RR:g}")

    def _check_dates(self) -> None:
        if self.exit_date < self.entry_date:
            raise ValueError("exit_date must not be before entry_date")
        same_day = self.exit_date == self.entry_date
        if same_day and self.entry_time and self.exit_time and self.exit_time < self.entry_time:
            raise ValueError("exit_time must not be before entry_time on the same day")

    def _check_checks(self) -> None:
        ids = [check.item_id for check in self.checks]
        if len(set(ids)) != len(ids):
            raise ValueError("each checklist item may appear only once")


def _forbid(model: BaseModel, names: tuple[str, ...], segment: str) -> None:
    present = [name for name in names if getattr(model, name) is not None]
    if present:
        raise ValueError(f"{segment} does not use: {', '.join(present)}")
