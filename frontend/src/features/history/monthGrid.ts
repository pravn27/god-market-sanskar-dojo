import type { MonthDay } from '../../api/client'

export type CellStatus = 'future' | 'full' | 'on-track' | 'short' | 'weekend'

/** How a day looks in the History grid, from its daily-ritual progress. */
export function cellStatus(day: MonthDay): CellStatus {
  if (day.future) return 'future'
  if (!day.marketDay) return 'weekend'
  if (day.full) return 'full'
  if (day.onTrack) return 'on-track'
  return 'short'
}
