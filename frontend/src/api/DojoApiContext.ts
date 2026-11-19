import { createContext, useContext } from 'react'

import type { DojoApi } from './client'

export const DojoApiContext = createContext<DojoApi | null>(null)

export function useDojoApi(): DojoApi {
  const api = useContext(DojoApiContext)
  if (!api) throw new Error('DojoApiContext is not provided.')
  return api
}
