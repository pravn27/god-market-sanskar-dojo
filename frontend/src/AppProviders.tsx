import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConfigProvider } from 'antd'
import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'

import type { DojoApi } from './api/client'
import { DojoApiContext } from './api/DojoApiContext'
import { createLocalDojoApi } from './api/localApi'
import { useUiStore } from './state/uiStore'
import { getAppTheme } from './theme'

export default function AppProviders({ children, api }: { children: ReactNode; api?: DojoApi }) {
  const themeMode = useUiStore((state) => state.themeMode)
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  )
  const [dojoApi] = useState(() => api ?? createLocalDojoApi())

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
  }, [themeMode])

  return (
    <ConfigProvider theme={getAppTheme(themeMode)}>
      <QueryClientProvider client={queryClient}>
        <DojoApiContext.Provider value={dojoApi}>
          <BrowserRouter>{children}</BrowserRouter>
        </DojoApiContext.Provider>
      </QueryClientProvider>
    </ConfigProvider>
  )
}
