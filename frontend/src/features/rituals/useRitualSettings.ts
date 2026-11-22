import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useDojoApi } from '../../api/DojoApiContext'
import type { RitualInput } from '../../api/client'

/** Upper limit enforced by the backend. */
export const MAX_ACTIVE_RITUALS = 12

export function useRitualDefinitions(date: string, enabled: boolean) {
  const api = useDojoApi()
  return useQuery({
    queryKey: ['rituals', date],
    queryFn: () => api.listRituals(date),
    enabled,
  })
}

/** Every change applies from today, so refresh the ritual list, today's Dojo and the History calendar. */
export function useRitualMutations() {
  const api = useDojoApi()
  const queryClient = useQueryClient()
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['rituals'] }),
      queryClient.invalidateQueries({ queryKey: ['dojo-day'] }),
      queryClient.invalidateQueries({ queryKey: ['month'] }),
    ])

  return {
    create: useMutation({
      mutationFn: (input: RitualInput) => api.createRitual(input),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ key, input }: { key: string; input: RitualInput }) => api.updateRitual(key, input),
      onSuccess: refresh,
    }),
    retire: useMutation({
      mutationFn: (key: string) => api.retireRitual(key),
      onSuccess: refresh,
    }),
    reorder: useMutation({
      mutationFn: (keys: string[]) => api.reorderRituals(keys),
      onSuccess: refresh,
    }),
  }
}
