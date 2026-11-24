import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { BacktestFilters, BacktestLog } from '../../api/client'
import { useDojoApi } from '../../api/DojoApiContext'
import type { BacktestInput } from '../../domain/backtest'

export function useBacktests(filters: BacktestFilters) {
  const api = useDojoApi()
  return useQuery({ queryKey: ['backtests', filters], queryFn: () => api.listBacktests(filters) })
}

/** Every mutation refreshes the list, so filters and totals stay in step with the saved logs. */
function useInvalidateBacktests() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['backtests'] })
}

export function useCreateBacktest() {
  const api = useDojoApi()
  const invalidate = useInvalidateBacktests()
  return useMutation({
    mutationFn: (input: BacktestInput) => api.createBacktest(input),
    onSuccess: invalidate,
  })
}

export function useUpdateBacktest() {
  const api = useDojoApi()
  const invalidate = useInvalidateBacktests()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: BacktestInput }): Promise<BacktestLog> => api.updateBacktest(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteBacktest() {
  const api = useDojoApi()
  const invalidate = useInvalidateBacktests()
  return useMutation({
    mutationFn: (id: number) => api.deleteBacktest(id),
    onSuccess: invalidate,
  })
}
