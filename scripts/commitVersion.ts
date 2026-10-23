import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { nextCommitVersion, packageVersion, readPackageVersions } from './packageVersions.ts'

const PACKAGE_FILES = ['package.json', 'package-lock.json']

function git(directory: string, args: string[]) {
  return execFileSync('git', args, { cwd: directory, encoding: 'utf8', timeout: 30_000 }).trim()
}

function hasRevision(directory: string, revision: string): boolean {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', revision], { cwd: directory, encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0 && result.status !== 1) throw new Error(`No se ha podido consultar ${revision}.`)
  return result.status === 0
}

export function updateCommitVersion(directory: string): string | null {
  if (!git(directory, ['diff', '--cached', '--name-only'])) return null
  // No incluir cambios de dependencias que el usuario haya dejado fuera del commit.
  if (git(directory, ['diff', '--name-only', '--', ...PACKAGE_FILES])) {
    throw new Error('Hay cambios sin preparar en package.json o package-lock.json. Prepáralos antes de hacer el commit.')
  }
  const contents = PACKAGE_FILES.map((file) => readFileSync(resolve(directory, file), 'utf8'))
  const { pkg, lock, version } = readPackageVersions(contents[0], contents[1])
  const previous = hasRevision(directory, 'HEAD') ? packageVersion(git(directory, ['show', 'HEAD:package.json'])) : null
  const next = nextCommitVersion(version, previous)
  if (next !== version) {
    pkg.version = next
    lock.version = next
    lock.packages[''].version = next
    writeFileSync(resolve(directory, PACKAGE_FILES[0]), `${JSON.stringify(pkg, null, 2)}\n`)
    writeFileSync(resolve(directory, PACKAGE_FILES[1]), `${JSON.stringify(lock, null, 2)}\n`)
    // Git proporciona su índice activo, también en los commits con rutas concretas.
    git(directory, ['add', '--', ...PACKAGE_FILES])
  }
  return next
}

export function syncCommittedVersion(directory: string) {
  const previousRevision = hasRevision(directory, 'HEAD@{1}') ? 'HEAD@{1}' : 'HEAD^'
  if (!hasRevision(directory, previousRevision)) return
  // git commit --only utiliza un índice temporal: después conserva en el índice
  // habitual las versiones anteriores. Actualizar solo esas entradas, sin tocar
  // otros archivos preparados ni cambios de dependencias que hubiera en el índice.
  for (const file of PACKAGE_FILES) {
    const staged = git(directory, ['show', `:${file}`])
    const previous = git(directory, ['show', `${previousRevision}:${file}`])
    if (staged !== previous) continue
    const committed = git(directory, ['show', `HEAD:${file}`])
    if (committed === previous) continue
    const before = JSON.parse(previous)
    const after = JSON.parse(committed)
    before.version = after.version
    if (file === 'package-lock.json') before.packages[''].version = after.packages[''].version
    if (JSON.stringify(before) !== JSON.stringify(after)) continue
    const mode = git(directory, ['ls-files', '--stage', '--', file]).split(/\s+/)[0]
    const blob = git(directory, ['rev-parse', `HEAD:${file}`])
    git(directory, ['update-index', '--cacheinfo', `${mode},${blob},${file}`])
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('El commit requiere Node.js 24. Ejecuta nvm use.')
    if (process.argv[2] === '--sync-index') syncCommittedVersion(process.cwd())
    else {
      const version = updateCommitVersion(process.cwd())
      if (version) console.log(`Versión del commit: ${version}`)
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'No se ha podido preparar la versión del commit.')
    process.exitCode = 1
  }
}
