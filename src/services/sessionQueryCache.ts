// Solo memoria de la sesión: nunca persiste datos privados en el navegador.
export class SessionQueryCache {
  private entries = new Map<string, { expiresAt: number; promise: Promise<unknown> }>()
  private readonly ttlMs: number

  constructor(ttlMs = 60_000) { this.ttlMs = ttlMs }

  load<T>(key: string, fetcher: () => PromiseLike<T>): Promise<T> {
    const existing = this.entries.get(key)
    if (existing && existing.expiresAt > Date.now()) return existing.promise as Promise<T>
    const entry = {
      expiresAt: Date.now() + this.ttlMs,
      promise: Promise.resolve().then(fetcher).then((value) => {
        // PostgREST resolves errors as { data, error }; a retry must actually
        // reach the server (including the existing JWT recovery path).
        if (value && typeof value === 'object' && 'error' in value && value.error) {
          if (this.entries.get(key) === entry) this.entries.delete(key)
        } else entry.expiresAt = Date.now() + this.ttlMs
        return value
      }),
    }
    this.entries.set(key, entry)
    void entry.promise.catch(() => {
      if (this.entries.get(key) === entry) this.entries.delete(key)
    })
    return entry.promise
  }

  clear() { this.entries.clear() }
}
