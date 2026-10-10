/** El almacenamiento local es opcional: Safari puede bloquearlo o quedarse sin espacio. */
export function readLocalStorage(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export function writeLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeLocalStorageItem(key: string) {
  try { localStorage.removeItem(key) } catch { /* La pantalla sigue funcionando sin caché. */ }
}

export function removeLocalStorageByPrefix(prefix: string) {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(prefix)) localStorage.removeItem(key)
    }
  } catch {
    // Solo se eliminan claves con este prefijo; la sesión se conserva.
  }
}
