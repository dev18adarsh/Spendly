import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { configureMockApi } from '@/services'

interface AppConfigValue {
  /**
   * Frontend-only switch that makes the sample data source fail on purpose,
   * so the error state can be reviewed before the API exists.
   */
  simulateApiErrors: boolean
  setSimulateApiErrors: (value: boolean) => void
}

const AppConfigContext = createContext<AppConfigValue | null>(null)

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [simulateApiErrors, setSimulateApiErrors] = useState(false)

  useEffect(() => {
    configureMockApi({ failWithError: simulateApiErrors })
  }, [simulateApiErrors])

  const value = useMemo<AppConfigValue>(
    () => ({ simulateApiErrors, setSimulateApiErrors }),
    [simulateApiErrors],
  )

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>
}

export function useAppConfig(): AppConfigValue {
  const context = useContext(AppConfigContext)
  if (!context) {
    throw new Error('useAppConfig must be used inside an <AppConfigProvider>.')
  }
  return context
}
