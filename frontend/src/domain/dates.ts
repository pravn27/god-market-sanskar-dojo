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
