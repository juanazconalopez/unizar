import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareVersions, readPackageVersions } from './packageVersions.ts'

type ReleaseCandidate = { sourceSha: string; previousReleaseSha: string | null; version: string }
type ReleaseStatus = { ready: false; reason: string } | { ready: true; candidate: ReleaseCandidate }
const SHA_PATTERN = /^[a-f0-9]{40}$/

function git(directory: string, args: string[], input?: string): string {
  return execFileSync('git', args, { cwd: directory, encoding: 'utf8', input, timeout: 30_000 }).trim()
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
    if (heads.release === sourceSha || message.match(/^Unizar-Source-Commit: ([a-f0-9]{40})$/m)?.[1] === sourceSha
      || git(directory, ['rev-parse', `${heads.release}^{tree}`]) === git(directory, ['rev-parse', `${sourceSha}^{tree}`])) {
      return { ready: false, reason: 'Este commit ya tiene una versión preparada. Si falló Cloudflare, reintenta ese build.' }
    }
    previousVersion = readPackageVersions(git(directory, ['show', `${heads.release}:package.json`]), git(directory, ['show', `${heads.release}:package-lock.json`])).version
  }
  const sourceVersion = readPackageVersions(git(directory, ['show', `${sourceSha}:package.json`]), git(directory, ['show', `${sourceSha}:package-lock.json`])).version
  if (previousVersion !== null && compareVersions(sourceVersion, previousVersion) <= 0) {
    throw new Error('El commit debe incluir una versión superior a release. Activa el hook con npm run setup:hooks antes de hacer el commit.')
  }
  return { ready: true, candidate: { sourceSha, previousReleaseSha: heads.release, version: sourceVersion } }
}

function readPackages(directory: string) {
  return readPackageVersions(readFileSync(resolve(directory, 'package.json'), 'utf8'), readFileSync(resolve(directory, 'package-lock.json'), 'utf8'))
}

export function prepareRelease(directory: string, sourceSha: string): ReleaseStatus {
  if (git(directory, ['status', '--porcelain'])) throw new Error('No se prepara una publicación con cambios locales.')
  const status = checkRelease(directory, sourceSha)
  if (!status.ready) return status
  readPackages(directory)
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
  if (git(directory, ['status', '--porcelain'])) throw new Error('La publicación no puede incluir cambios locales durante la validación.')
  const tree = git(directory, ['rev-parse', `${candidate.sourceSha}^{tree}`])
  const releaseParents = ['-p', candidate.sourceSha]
  if (candidate.previousReleaseSha) releaseParents.push('-p', candidate.previousReleaseSha)
  const releaseCommit = git(directory, ['-c', 'commit.gpgsign=false', 'commit-tree', tree, ...releaseParents],
    `chore(release): v${candidate.version}\n\nUnizar-Source-Commit: ${candidate.sourceSha}\n`)
  const latest = remoteHeads(directory)
  if (latest.main !== candidate.sourceSha) return { published: false, reason: 'Ha llegado otro commit a main; se publicará el más reciente.' }
  if (latest.release !== candidate.previousReleaseSha) throw new Error('Otra publicación ha cambiado release antes del envío.')
  // Solo avanza release, sin forzar el push ni generar otro commit de versión en main.
  git(directory, ['push', '--quiet', 'origin', `${releaseCommit}:refs/heads/release`])
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
