// Solo memoria de la sesión: nunca persiste datos privados en el navegador.
export class SessionQueryCache {
  private entries = new Map<string, { expiresAt: number; promise: Promise<unknown>; pending: boolean; value?: unknown }>()
  private readonly ttlMs: number

  constructor(ttlMs = 60_000) { this.ttlMs = ttlMs }

  peek<T>(key: string): T | undefined { return this.entries.get(key)?.value as T | undefined }

  load<T>(key: string, fetcher: () => PromiseLike<T>, options: { force?: boolean } = {}): Promise<T> {
    const existing = this.entries.get(key)
    if (existing && !options.force && (existing.pending || existing.expiresAt > Date.now())) return existing.promise as Promise<T>
    const entry = {
      pending: true,
      value: existing?.value,
      expiresAt: Date.now() + this.ttlMs,
      promise: Promise.resolve().then(fetcher).then((value) => {
        entry.pending = false
        // PostgREST resolves errors as { data, error }; a retry must actually
        // reach the server (including the existing JWT recovery path).
        if (value && typeof value === 'object' && 'error' in value && value.error) {
          entry.expiresAt = 0
          if (this.entries.get(key) === entry && entry.value === undefined) this.entries.delete(key)
        } else { entry.expiresAt = Date.now() + this.ttlMs; entry.value = value }
        return value
      }),
    }
    this.entries.set(key, entry)
    void entry.promise.catch(() => {
      entry.pending = false
      entry.expiresAt = 0
      if (this.entries.get(key) === entry && entry.value === undefined) this.entries.delete(key)
    })
    return entry.promise
  }

  invalidatePrefix(prefix: string) {
    for (const key of this.entries.keys()) if (key.startsWith(prefix)) this.entries.delete(key)
  }

  clear() { this.entries.clear() }
}
