import { useQuery } from '@tanstack/react-query'

import { useDojoApi } from '../../api/DojoApiContext'
import type { IsoDate } from '../../domain/dates'

/** Each view fetches only while it is on screen (`enabled`), so switching views does not fetch the others. */
export function useMonthHistory(month: string, enabled = true) {
  const api = useDojoApi()
  return useQuery({ queryKey: ['month', month], queryFn: () => api.getMonth(month), enabled })
}

export function useWeekHistory(weekStart: IsoDate, enabled = true) {
  const api = useDojoApi()
  return useQuery({ queryKey: ['week', weekStart], queryFn: () => api.getWeek(weekStart), enabled })
}

export function useYearHistory(year: number, enabled = true) {
  const api = useDojoApi()
  return useQuery({ queryKey: ['year', year], queryFn: () => api.getYear(year), enabled })
}

export function useGrowth() {
  const api = useDojoApi()
  return useQuery({ queryKey: ['growth'], queryFn: () => api.getGrowth() })
}
