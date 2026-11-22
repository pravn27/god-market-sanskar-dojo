/** Calendar dates are `YYYY-MM-DD` strings in the user's local (market) time zone. */
export type IsoDate = string

export function toIsoDate(date: Date): IsoDate {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function toUtcMs(iso: IsoDate): number {
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = new Date(toUtcMs(iso) + days * 86_400_000)
  return date.toISOString().slice(0, 10)
}

/** The Monday of the week containing `iso`. Weeks start on Monday throughout the app. */
export function mondayOf(iso: IsoDate): IsoDate {
  return addDays(iso, -((dayOfWeek(iso) + 6) % 7))
}

/** Ticks can be corrected for the last 7 days, today included. Older days are read-only. Mirrors `EDIT_WINDOW_DAYS` in the API. */
export const EDIT_WINDOW_DAYS = 7

export function isEditableDay(date: IsoDate, today: IsoDate): boolean {
  return date <= today && date >= addDays(today, -(EDIT_WINDOW_DAYS - 1))
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(iso: IsoDate): number {
  return new Date(toUtcMs(iso)).getUTCDay()
}

export function daysSinceEpoch(iso: IsoDate): number {
  return Math.floor(toUtcMs(iso) / 86_400_000)
}

export function isWeekend(iso: IsoDate): boolean {
  const day = dayOfWeek(iso)
  return day === 0 || day === 6
}

/**
 * True when `iso` is one of the last two market days of its month.
 * Weekdays only until a holiday list is configured.
 */
export function isLastTwoMarketDaysOfMonth(iso: IsoDate, holidays: ReadonlySet<IsoDate> = new Set()): boolean {
  const isMarket = (d: IsoDate) => !isWeekend(d) && !holidays.has(d)
  if (!isMarket(iso)) return false
  const month = iso.slice(0, 7)
  let marketDaysLeft = 1
  for (let d = addDays(iso, 1); d.slice(0, 7) === month; d = addDays(d, 1)) {
    if (isMarket(d)) marketDaysLeft += 1
  }
  return marketDaysLeft <= 2
}
