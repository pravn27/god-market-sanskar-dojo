import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useDojoApi } from '../../api/DojoApiContext'
import type { IsoDate } from '../../domain/dates'

export function useDojoDay(date: IsoDate) {
  const api = useDojoApi()
  return useQuery({ queryKey: ['dojo-day', date], queryFn: () => api.getDojoDay(date) })
}

export function useToggleRitual(date: IsoDate) {
  const api = useDojoApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ritualId: string) => api.toggleRitual(date, ritualId),
    onSuccess: (day) => {
      queryClient.setQueryData(['dojo-day', date], day)
      void queryClient.invalidateQueries({ queryKey: ['month'] })
    },
  })
}
