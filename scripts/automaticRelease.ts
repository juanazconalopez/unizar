import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type ReleaseCandidate = { sourceSha: string; previousReleaseSha: string | null; version: string }
type ReleaseStatus = { ready: false; reason: string } | { ready: true; candidate: ReleaseCandidate }
const SHA_PATTERN = /^[a-f0-9]{40}$/
const PACKAGE_FILES = ['package.json', 'package-lock.json']

function git(directory: string, args: string[], input?: string): string {
  return execFileSync('git', args, { cwd: directory, encoding: 'utf8', input, timeout: 30_000 }).trim()
}

function versionParts(version: string): number[] {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error(`Versión no válida: ${version}`)
  const parts = version.split('.').map(Number)
  if (parts.some((part) => !Number.isSafeInteger(part))) throw new Error(`Versión no válida: ${version}`)
  return parts
}

export function nextReleaseVersion(sourceVersion: string, previousVersion: string | null): string {
  const source = versionParts(sourceVersion)
  const previous = previousVersion === null ? source : versionParts(previousVersion)
  if (previousVersion !== null) {
    for (let index = 0; index < 3; index++) {
      if (source[index] > previous[index]) return sourceVersion
      if (source[index] < previous[index]) break
    }
  }
  if (!Number.isSafeInteger(previous[2] + 1)) throw new Error('No se puede incrementar la versión.')
  return `${previous[0]}.${previous[1]}.${previous[2] + 1}`
}

function remoteHeads(directory: string): { main: string | null; release: string | null } {
  const heads = git(directory, ['ls-remote', '--heads', 'origin', 'refs/heads/main', 'refs/heads/release'])
  const entries = new Map(heads.split('\n').filter(Boolean).map((line) => {
    const [sha, ref] = line.split(/\s+/)
    if (!SHA_PATTERN.test(sha)) throw new Error('El repositorio devolvió un identificador no válido.')
    return [ref, sha]
  }))
  return { main: entries.get('refs/heads/main') ?? null, release: entries.get('refs/heads/release') ?? null }
}

function packageVersion(contents: string): string {
  const data = JSON.parse(contents) as { version?: unknown }
  if (typeof data.version !== 'string') throw new Error('Falta la versión de package.json.')
  versionParts(data.version)
  return data.version
}

export function checkRelease(directory: string, sourceSha: string): ReleaseStatus {
  if (!SHA_PATTERN.test(sourceSha) || git(directory, ['rev-parse', 'HEAD']) !== sourceSha) {
    throw new Error('La publicación debe usar exactamente el commit seleccionado de main.')
  }
  const heads = remoteHeads(directory)
  if (!heads.main) throw new Error('No existe la rama main en origin.')
  if (heads.main !== sourceSha) return { ready: false, reason: 'Hay commits posteriores en main; se espera su publicación.' }
  let previousVersion: string | null = null
  if (heads.release) {
    git(directory, ['fetch', '--quiet', '--no-tags', 'origin', heads.release])
    const message = git(directory, ['show', '-s', '--format=%B', heads.release])
    if (message.match(/^Unizar-Source-Commit: ([a-f0-9]{40})$/m)?.[1] === sourceSha) {
      return { ready: false, reason: 'Este commit ya tiene una versión preparada. Si falló Cloudflare, reintenta ese build.' }
    }
    previousVersion = packageVersion(git(directory, ['show', `${heads.release}:package.json`]))
  }
  const sourceVersion = packageVersion(git(directory, ['show', `${sourceSha}:package.json`]))
  return { ready: true, candidate: { sourceSha, previousReleaseSha: heads.release, version: nextReleaseVersion(sourceVersion, previousVersion) } }
}

function readPackages(directory: string) {
  const pkg = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8')) as { version: string }
  const lock = JSON.parse(readFileSync(resolve(directory, 'package-lock.json'), 'utf8')) as { version: string; packages?: Record<string, { version?: string }> }
  if (typeof pkg.version !== 'string' || lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) {
    throw new Error('package.json y package-lock.json deben tener la misma versión.')
  }
  versionParts(pkg.version)
  return { pkg, lock }
}

export function prepareRelease(directory: string, sourceSha: string): ReleaseStatus {
  if (git(directory, ['status', '--porcelain'])) throw new Error('No se prepara una publicación con cambios locales.')
  const status = checkRelease(directory, sourceSha)
  if (!status.ready) return status
  const { pkg, lock } = readPackages(directory)
  pkg.version = status.candidate.version
  lock.version = status.candidate.version
  lock.packages![''].version = status.candidate.version
  writeFileSync(resolve(directory, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
  writeFileSync(resolve(directory, 'package-lock.json'), `${JSON.stringify(lock, null, 2)}\n`)
  return status
}

export function publishRelease(directory: string, candidate: ReleaseCandidate): { published: boolean; reason: string } {
  const status = checkRelease(directory, candidate.sourceSha)
  if (!status.ready) return { published: false, reason: status.reason }
  if (status.candidate.previousReleaseSha !== candidate.previousReleaseSha || status.candidate.version !== candidate.version) {
    throw new Error('La rama release ha cambiado; hay que preparar de nuevo la publicación.')
  }
  const { pkg } = readPackages(directory)
  if (pkg.version !== candidate.version) throw new Error('La versión preparada no coincide con la publicación.')
  const changed = git(directory, ['diff', '--name-only', candidate.sourceSha]).split('\n').filter(Boolean)
  if (changed.some((file) => !PACKAGE_FILES.includes(file)) || git(directory, ['ls-files', '--others', '--exclude-standard'])) {
    throw new Error('La publicación solo puede modificar las versiones de package.json y package-lock.json.')
  }
  git(directory, ['add', '--', ...PACKAGE_FILES])
  const tree = git(directory, ['write-tree'])
  const parents = ['-p', candidate.sourceSha]
  if (candidate.previousReleaseSha && candidate.previousReleaseSha !== candidate.sourceSha) parents.push('-p', candidate.previousReleaseSha)
  const commit = git(directory, ['-c', 'commit.gpgsign=false', 'commit-tree', tree, ...parents],
    `chore(release): v${candidate.version}\n\nUnizar-Source-Commit: ${candidate.sourceSha}\n`)
  const latest = remoteHeads(directory)
  if (latest.main !== candidate.sourceSha) return { published: false, reason: 'Ha llegado otro commit a main; se publicará el más reciente.' }
  if (latest.release !== candidate.previousReleaseSha) throw new Error('Otra publicación ha cambiado release antes del envío.')
  // El commit conserva el historial de release y el origen de main. Nunca se fuerza el push.
  git(directory, ['push', '--quiet', 'origin', `${commit}:refs/heads/release`])
  return { published: true, reason: `Versión ${candidate.version} enviada a release; Cloudflare preparará el despliegue.` }
}

function writeOutputs(status: ReleaseStatus) {
  const outputFile = process.env.GITHUB_OUTPUT
  if (outputFile) {
    const outputs = status.ready
      ? `ready=true\nversion=${status.candidate.version}\nprevious_release_sha=${status.candidate.previousReleaseSha ?? ''}\n`
      : 'ready=false\n'
    appendFileSync(outputFile, outputs)
  }
  console.log(status.ready ? `Versión candidata: ${status.candidate.version}` : status.reason)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('La publicación automática solo se ejecuta desde GitHub Actions.')
    const directory = process.cwd()
    const sourceSha = process.env.UNIZAR_SOURCE_SHA ?? ''
    const command = process.argv[2]
    if (command === 'check') writeOutputs(checkRelease(directory, sourceSha))
    else if (command === 'prepare') writeOutputs(prepareRelease(directory, sourceSha))
    else if (command === 'publish') {
      const previousReleaseSha = process.env.UNIZAR_PREVIOUS_RELEASE_SHA || null
      if (previousReleaseSha !== null && !SHA_PATTERN.test(previousReleaseSha)) throw new Error('Identificador de release no válido.')
      const result = publishRelease(directory, { sourceSha, previousReleaseSha, version: process.env.UNIZAR_RELEASE_VERSION ?? '' })
      console.log(result.reason)
    } else throw new Error('Usa check, prepare o publish.')
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'No se pudo preparar la publicación.')
    process.exitCode = 1
  }
}
