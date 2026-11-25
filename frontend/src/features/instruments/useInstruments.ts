import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useDojoApi } from '../../api/DojoApiContext'
import type { InstrumentInput } from '../../api/client'

export function useInstruments(enabled = true) {
  const api = useDojoApi()
  return useQuery({ queryKey: ['instruments'], queryFn: () => api.listInstruments(), enabled })
}

/** Every change refreshes the list, so the dropdowns in Trade Gate and the backtest log stay current. */
export function useInstrumentMutations() {
  const api = useDojoApi()
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['instruments'] })

  return {
    create: useMutation({
      mutationFn: (input: InstrumentInput) => api.createInstrument(input),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: number; input: InstrumentInput }) => api.updateInstrument(id, input),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api.deleteInstrument(id),
      onSuccess: refresh,
    }),
  }
}
