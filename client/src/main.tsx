import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/inter'
import './index.css'

import { App } from './App'
import { AuthProvider } from './auth/AuthProvider'
import { AppConfigProvider } from './config/app-config'

const container = document.getElementById('root')

if (!container) {
  throw new Error('Root element #root was not found in index.html')
}

createRoot(container).render(
  <StrictMode>
    <AppConfigProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppConfigProvider>
  </StrictMode>,
)
