"""Request contracts for ritual definitions."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

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
