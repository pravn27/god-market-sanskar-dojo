import type { GrowthMonth, MonthDay } from '../../api/client'
import { addDays, type IsoDate } from '../../domain/dates'

export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** e.g. "November 2026". */
export function monthTitle(month: string): string {
  const [year, number] = month.split('-').map(Number)
  return `${MONTHS_LONG[number - 1]} ${year}`
}

/** e.g. "16 Nov – 22 Nov 2026", or "29 Dec 2025 – 4 Jan 2026" across a year end. */
export function weekTitle(weekStart: IsoDate): string {
  const weekEnd = addDays(weekStart, 6)
  const [sy, sm, sd] = weekStart.split('-').map(Number)
  const [ey, em, ed] = weekEnd.split('-').map(Number)
  const start = sy === ey ? `${sd} ${MONTHS_SHORT[sm - 1]}` : `${sd} ${MONTHS_SHORT[sm - 1]} ${sy}`
  return `${start} – ${ed} ${MONTHS_SHORT[em - 1]} ${ey}`
}

/** The chart's accessible text, so the numbers are readable without the chart. */
export function growthSummary(months: GrowthMonth[]): string {
  const parts = months.map((m) => `${monthShortLabel(m.month)}: ${m.onTrackDays} of ${m.marketDays} market days on track`)
  return `On-track market days per month. ${parts.join('. ')}.`
}

export type CellStatus = 'future' | 'full' | 'on-track' | 'short'

/** The three colours shared by the Month, Week and Year views. */
export const LEGEND: { status: CellStatus; label: string }[] = [
  { status: 'full', label: 'Every daily ritual done' },
  { status: 'on-track', label: 'Streak minimum met' },
  { status: 'short', label: 'Below streak minimum' },
]

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** e.g. "Tue 17 Nov". */
export function shortDate(iso: IsoDate): string {
  const [year, month, day] = iso.split('-').map(Number)
  const weekday = WEEKDAYS_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${weekday} ${day} ${MONTHS_SHORT[month - 1]}`
}

/** `2026-11` becomes `Nov 26`, so months from different years stay distinct on the chart. */
export function monthShortLabel(month: string): string {
  const number = Number(month.slice(5, 7))
  return `${MONTHS_SHORT[number - 1]} ${month.slice(2, 4)}`
}

/** How a day looks in the History grid, from its daily-ritual progress. Non-market days use the same rules. */
export function cellStatus(day: MonthDay): CellStatus {
  if (day.future) return 'future'
  if (day.full) return 'full'
  if (day.onTrack) return 'on-track'
  return 'short'
}
