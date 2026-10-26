import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type Lockfile = { version?: string; packages?: Record<string, { version?: string }> }

export function dependencyFingerprint(contents: string): string {
  const lock = JSON.parse(contents) as Lockfile
  // El hook cambia estas versiones en cada commit, sin cambiar dependencias.
  delete lock.version
  if (lock.packages?.['']) delete lock.packages[''].version
  return createHash('sha256').update(JSON.stringify(lock)).digest('hex')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  console.log(`fingerprint=${dependencyFingerprint(readFileSync('package-lock.json', 'utf8'))}`)
}
