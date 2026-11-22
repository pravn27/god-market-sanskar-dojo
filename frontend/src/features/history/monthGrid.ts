import type { GrowthMonth, MonthDay } from '../../api/client'

/** The chart's accessible text, so the numbers are readable without the chart. */
export function growthSummary(months: GrowthMonth[]): string {
  const parts = months.map((m) => `${monthShortLabel(m.month)}: ${m.onTrackDays} of ${m.marketDays} market days on track`)
  return `On-track market days per month. ${parts.join('. ')}.`
}

export type CellStatus = 'future' | 'full' | 'on-track' | 'short'

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
