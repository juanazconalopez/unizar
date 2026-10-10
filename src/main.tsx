import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppLaunchSplash } from './components/pwa/AppLaunchSplash.tsx'
import { PwaUpdatePrompt } from './components/pwa/PwaUpdatePrompt.tsx'
import { ViewErrorBoundary } from './components/AsyncViewState.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ViewErrorBoundary><App /></ViewErrorBoundary>
    <AppLaunchSplash />
    <PwaUpdatePrompt />
  </StrictMode>,
)
