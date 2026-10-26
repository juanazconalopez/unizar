import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/App.css'
import './demo.css'
import { DemoApp } from './DemoApp'
import { AppLaunchSplash } from '../src/components/pwa/AppLaunchSplash'
import { ViewErrorBoundary } from '../src/components/AsyncViewState'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ViewErrorBoundary><DemoApp /></ViewErrorBoundary>
    <AppLaunchSplash />
  </StrictMode>,
)
