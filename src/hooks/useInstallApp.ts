import { useSyncExternalStore } from 'react'

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform: string }

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<InstallChoice>
}

function isStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia?.('(display-mode: standalone)').matches === true || iosNavigator.standalone === true
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

let installPrompt: BeforeInstallPromptEvent | null = null
let installed = isStandalone()
let version = 0
const subscribers = new Set<() => void>()

function notifySubscribers() {
  version += 1
  subscribers.forEach((subscriber) => subscriber())
}

function rememberPrompt(event: Event) {
  event.preventDefault()
  installPrompt = event as BeforeInstallPromptEvent
  notifySubscribers()
}

function markInstalled() {
  installed = true
  installPrompt = null
  notifySubscribers()
}

window.addEventListener('beforeinstallprompt', rememberPrompt)
window.addEventListener('appinstalled', markInstalled)

function subscribe(subscriber: () => void) {
  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}

export function useInstallApp() {
  useSyncExternalStore(subscribe, () => version)

  async function install() {
    if (!installPrompt) return false
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      installPrompt = null
      notifySubscribers()
    }
    return choice.outcome === 'accepted'
  }

  return {
    canInstall: !installed && installPrompt !== null,
    installed,
    needsIosInstructions: !installed && isIosDevice(),
    install,
  }
}
