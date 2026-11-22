import { useQuery } from '@tanstack/react-query'

import { useDojoApi } from '../../api/DojoApiContext'

export function useMonthHistory(month: string) {
  const api = useDojoApi()
  return useQuery({ queryKey: ['month', month], queryFn: () => api.getMonth(month) })
}
