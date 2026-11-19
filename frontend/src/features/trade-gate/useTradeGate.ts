import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { LogTradePlanInput } from '../../api/client'
import { useDojoApi } from '../../api/DojoApiContext'

export function useTradeGateStatus() {
  const api = useDojoApi()
  return useQuery({ queryKey: ['trade-gate-status'], queryFn: () => api.getTradeGateStatus() })
}

export function useLogTradePlan() {
  const api = useDojoApi()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LogTradePlanInput) => api.logTradePlan(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trade-gate-status'] }),
  })
}
