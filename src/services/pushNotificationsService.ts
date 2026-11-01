import { supabase } from '../lib/supabase'
import { readLocalStorage, removeLocalStorageItem, writeLocalStorage } from '../lib/browserStorage'
import { DEFAULT_PUSH_TOPICS } from '../features/notifications/pushTopics'
import type { PushTopic } from '../features/notifications/pushTopics'

const DEVICE_STORAGE = 'cdu-push-device'
const OWNER_STORAGE = 'cdu-push-owner'
const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined
let accountReconciliation = Promise.resolve()

export type PushDeviceState = {
  enabled: boolean
  topics: PushTopic[]
}

export function pushSupportMessage(): string | null {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone
  if (ios && !standalone) return 'Para recibir notificaciones en iPhone o iPad, añade la aplicación a la pantalla de inicio y ábrela desde su icono (iOS 16.4 o posterior).'
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'Este navegador no admite notificaciones push. Prueba con un navegador actualizado.'
  }
  if (!publicKey) return 'Las notificaciones push todavía no están habilitadas para esta aplicación.'
  if (Notification.permission === 'denied') return 'Las notificaciones están bloqueadas. Puedes permitirlas desde los ajustes de este sitio en tu navegador.'
  return null
}

async function registration() {
  // No esperar indefinidamente a ready si todavía no hay una PWA instalada.
  const registered = await navigator.serviceWorker.getRegistration()
  if (!registered?.active) throw new Error('La aplicación se está preparando. Recarga la página y vuelve a intentarlo.')
  return registered
}

function deviceKey() {
  const saved = readLocalStorage(DEVICE_STORAGE)
  if (saved) return saved
  const key = crypto.randomUUID()
  if (!writeLocalStorage(DEVICE_STORAGE, key)) throw new Error('Permite el almacenamiento de este sitio para activar las notificaciones.')
  return key
}

async function requireAccount(userId: string) {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user.id !== userId) throw new Error('La cuenta ha cambiado. Vuelve a abrir los avisos.')
}

async function setWorkerOwner(owner: string | null) {
  if (!('serviceWorker' in navigator)) return
  const registered = await navigator.serviceWorker.getRegistration()
  if (!registered?.active) return
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel()
    const timer = window.setTimeout(() => { channel.port1.close(); reject(new Error('Recarga la aplicación para preparar las notificaciones.')) }, 5000)
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer)
      channel.port1.close()
      if (event.data?.ok) resolve()
      else reject(new Error('No se ha podido preparar este dispositivo.'))
    }
    registered.active!.postMessage({ type: 'PUSH_ACCOUNT', owner }, [channel.port2])
  })
}

export async function getPushDeviceState(userId: string): Promise<PushDeviceState> {
  const key = readLocalStorage(DEVICE_STORAGE)
  if (!key || !('serviceWorker' in navigator)) return { enabled: false, topics: DEFAULT_PUSH_TOPICS }
  const registered = await navigator.serviceWorker.getRegistration()
  const subscription = await registered?.pushManager.getSubscription()
  if (!subscription || Notification.permission !== 'granted') return { enabled: false, topics: DEFAULT_PUSH_TOPICS }
  await requireAccount(userId)
  const { data, error } = await supabase.rpc('get_own_push_device', { checked_device_key: key })
  if (error) throw error
  const device = data?.[0]
  return { enabled: Boolean(device), topics: device?.topics as PushTopic[] ?? DEFAULT_PUSH_TOPICS }
}

export async function enablePush(userId: string, topics: PushTopic[]): Promise<void> {
  const message = pushSupportMessage()
  if (message) throw new Error(message)
  // La petición se inicia directamente desde el botón, antes de cualquier espera.
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('No se han autorizado las notificaciones en este dispositivo.')
  await requireAccount(userId)
  const key = deviceKey()
  const registered = await registration()
  let subscription = await registered.pushManager.getSubscription()
  if (subscription && readLocalStorage(OWNER_STORAGE) !== userId) {
    if (!await subscription.unsubscribe()) throw new Error('No se ha podido desvincular la cuenta anterior.')
    subscription = null
  }
  if (!subscription) subscription = await registered.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodePublicKey(publicKey!) })
  const serialized = subscription.toJSON()
  if (!serialized.keys?.p256dh || !serialized.keys.auth) throw new Error('El navegador no ha generado una suscripción válida.')
  try {
    await requireAccount(userId)
    const { error } = await supabase.rpc('register_push_device', {
      checked_device_key: key, checked_endpoint: subscription.endpoint,
      checked_p256dh: serialized.keys.p256dh, checked_auth: serialized.keys.auth, checked_topics: topics,
    })
    if (error) throw error
    await requireAccount(userId)
    await setWorkerOwner(userId)
    await requireAccount(userId)
    if (!writeLocalStorage(OWNER_STORAGE, userId)) throw new Error('No se ha podido guardar la cuenta de este dispositivo.')
  } catch (error) {
    await Promise.allSettled([
      subscription.unsubscribe(),
      supabase.rpc('unregister_push_device', { checked_device_key: key }),
      setWorkerOwner(null),
    ])
    throw error
  }
}

export async function savePushTopics(userId: string, topics: PushTopic[]) {
  await requireAccount(userId)
  const { error } = await supabase.rpc('set_own_push_topics', { checked_device_key: deviceKey(), checked_topics: topics })
  if (error) throw error
}

export async function sendPushTest(userId: string) {
  await requireAccount(userId)
  const { error } = await supabase.rpc('queue_own_push_test', { checked_device_key: deviceKey() })
  if (error) throw error
}

export async function disablePush(): Promise<void> {
  const key = readLocalStorage(DEVICE_STORAGE)
  const owner = readLocalStorage(OWNER_STORAGE)
  let removedInBrowser = false
  if ('serviceWorker' in navigator) {
    try {
      const registered = await navigator.serviceWorker.getRegistration()
      const subscription = await registered?.pushManager.getSubscription()
      removedInBrowser = !subscription || await subscription.unsubscribe()
      if (key || owner || subscription) await setWorkerOwner(null)
    } catch {
      // El registro del servidor también se revoca aunque falle el navegador.
    }
  } else removedInBrowser = true
  let removedInServer = !key
  if (key) {
    try {
      const { error } = await supabase.rpc('unregister_push_device', { checked_device_key: key })
      removedInServer = !error
    } catch { removedInServer = false }
  }
  if (!removedInBrowser && !removedInServer) throw new Error('No se han podido desactivar las notificaciones. Recupera la conexión y vuelve a intentarlo.')
  removeLocalStorageItem(OWNER_STORAGE)
  removeLocalStorageItem(DEVICE_STORAGE)
}

/** No se heredan suscripciones al cambiar de cuenta, tampoco entre pestañas. */
export function reconcilePushAccount(userId: string | null) {
  accountReconciliation = accountReconciliation.catch(() => undefined).then(async () => {
    const { data } = await supabase.auth.getSession()
    if ((data.session?.user.id ?? null) !== userId) return
    const owner = readLocalStorage(OWNER_STORAGE)
    if (owner && owner !== userId) await disablePush()
    else if (owner === userId && owner) await setWorkerOwner(owner)
  })
  return accountReconciliation
}

export function decodePublicKey(value: string): Uint8Array<ArrayBuffer> {
  const bytes = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4))
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0))
}
