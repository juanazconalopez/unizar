declare const __APP_VERSION__: string

// Se incorpora al código en el build: nunca se sustituye por la versión del servidor.
export const APP_VERSION = __APP_VERSION__

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function isNewerAppVersion(latest: string, current: string): boolean {
  if (!VERSION_PATTERN.test(latest) || !VERSION_PATTERN.test(current)) return false
  const latestParts = latest.split('.').map(Number)
  const currentParts = current.split('.').map(Number)
  for (let index = 0; index < 3; index++) {
    if (latestParts[index] !== currentParts[index]) return latestParts[index] > currentParts[index]
  }
  return false
}

export async function getLatestAppVersion(signal: AbortSignal): Promise<string> {
  // La query evita reutilizar una respuesta antigua también en la caché del servidor.
  const response = await fetch(`/version.json?check=${Date.now()}`, { cache: 'no-store', signal })
  if (!response.ok) throw new Error('No se pudo comprobar la versión de la aplicación.')
  const data: unknown = await response.json()
  if (typeof data !== 'object' || data === null || !('version' in data)
    || typeof data.version !== 'string' || !VERSION_PATTERN.test(data.version)) {
    throw new Error('No se pudo comprobar la versión de la aplicación.')
  }
  return data.version
}
