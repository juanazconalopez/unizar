import { useCallback, useEffect, useState } from 'react'
import { navigationFromLocation, urlForNavigation } from '../lib/navigation'
import type { NavigationTarget } from '../lib/navigation'
import type { ViewName } from '../types'
import { preloadView } from '../app/viewModules'

export function useAppNavigation(onNavigate?: () => void) {
  const [navigation, setNavigation] = useState<NavigationTarget>(() => navigationFromLocation())

  const navigate = useCallback((next: ViewName | NavigationTarget, replace = false) => {
    const target = typeof next === 'string' ? { view: next } : next
    preloadView(target.view)
    onNavigate?.()
    window.history[replace ? 'replaceState' : 'pushState'](target, '', urlForNavigation(target))
    setNavigation(target)
  }, [onNavigate])

  const replaceNavigation = useCallback((target: NavigationTarget) => {
    preloadView(target.view)
    window.history.replaceState(target, '', urlForNavigation(target))
    setNavigation(target)
  }, [])

  useEffect(() => {
    function restoreNavigation() {
      const target = navigationFromLocation()
      preloadView(target.view)
      setNavigation(target)
    }
    window.addEventListener('popstate', restoreNavigation)
    return () => window.removeEventListener('popstate', restoreNavigation)
  }, [])

  return { navigation, view: navigation.view, navigate, replaceNavigation }
}
