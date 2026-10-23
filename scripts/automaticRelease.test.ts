import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { checkRelease, prepareRelease, publishRelease } from './automaticRelease.ts'
import { updateCommitVersion } from './commitVersion.ts'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function git(directory: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: 'pipe' }).trim()
}

function repository() {
  const root = mkdtempSync(join(tmpdir(), 'unizar-release-test-'))
  directories.push(root)
  const remote = join(root, 'origin.git')
  const work = join(root, 'work')
  git(root, 'init', '--quiet', '--bare', '--initial-branch=main', remote)
  git(root, 'clone', '--quiet', remote, work)
  git(work, 'config', 'user.name', 'Release test')
  git(work, 'config', 'user.email', 'release@example.test')
  git(work, 'config', 'commit.gpgsign', 'false')
  writeFileSync(join(work, 'package.json'), JSON.stringify({ name: 'test-app', version: '1.0.0' }, null, 2) + '\n')
  writeFileSync(join(work, 'package-lock.json'), JSON.stringify({ version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'test-app', version: '1.0.0' } } }, null, 2) + '\n')
  writeFileSync(join(work, 'app.txt'), 'initial app\n')
  git(work, 'add', '.')
  git(work, 'commit', '--quiet', '-m', 'Initial main')
  git(work, 'push', '--quiet', 'origin', 'main')
  return { remote, work, sourceSha: git(work, 'rev-parse', 'HEAD') }
}

function changeMain(work: string) {
  git(work, 'fetch', '--quiet', 'origin', 'main')
  git(work, 'reset', '--hard', 'origin/main')
  writeFileSync(join(work, 'app.txt'), 'new app\n')
  git(work, 'add', 'app.txt')
  updateCommitVersion(work)
  git(work, 'commit', '--quiet', '-m', 'Next main change')
  git(work, 'push', '--quiet', 'origin', 'main')
  return git(work, 'rev-parse', 'HEAD')
}

describe('automatic release against a real Git repository', () => {
  test('publica la versión del commit sin generar otro commit en main', () => {
    const repo = repository()
    expect(checkRelease(repo.work, repo.sourceSha).ready).toBe(true)
    const status = prepareRelease(repo.work, repo.sourceSha)
    expect(status.ready).toBe(true)
    if (!status.ready) throw new Error('Missing release candidate')
    expect(status.candidate.version).toBe('1.0.0')
    expect(git(repo.work, 'status', '--porcelain')).toBe('')
    expect(git(repo.remote, 'show', 'main:package.json')).toContain('"version": "1.0.0"')
    expect(git(repo.remote, 'ls-remote', '.', 'refs/heads/release')).toBe('')
    expect(publishRelease(repo.work, status.candidate).published).toBe(true)
    expect(git(repo.remote, 'show', 'main:package.json')).toContain('"version": "1.0.0"')
    expect(git(repo.remote, 'show', 'main:package-lock.json')).toContain('"version": "1.0.0"')
    expect(git(repo.remote, 'show', 'main:app.txt')).toBe('initial app')
    expect(git(repo.remote, 'rev-parse', 'main')).toBe(repo.sourceSha)
    expect(git(repo.remote, 'rev-parse', 'main^{tree}')).toBe(git(repo.remote, 'rev-parse', 'release^{tree}'))
    const pkg = JSON.parse(git(repo.remote, 'show', 'release:package.json'))
    const lock = JSON.parse(git(repo.remote, 'show', 'release:package-lock.json'))
    expect([pkg.version, lock.version, lock.packages[''].version]).toEqual(['1.0.0', '1.0.0', '1.0.0'])
    expect(git(repo.remote, 'show', 'release:app.txt')).toBe('initial app')
    expect(git(repo.remote, 'show', '-s', '--format=%B', 'release')).toContain(`Unizar-Source-Commit: ${git(repo.remote, 'rev-parse', 'main')}`)
  })

  test('retries the same source without creating another release or incrementing its version', () => {
    const repo = repository()
    const status = prepareRelease(repo.work, repo.sourceSha)
    if (!status.ready) throw new Error('Missing release candidate')
    publishRelease(repo.work, status.candidate)
    const published = git(repo.remote, 'rev-parse', 'release')
    expect(publishRelease(repo.work, status.candidate).published).toBe(false)
    git(repo.work, 'reset', '--hard', repo.sourceSha)
    expect(prepareRelease(repo.work, repo.sourceSha).ready).toBe(false)
    expect(git(repo.remote, 'rev-parse', 'release')).toBe(published)
    expect(JSON.parse(readFileSync(join(repo.work, 'package.json'), 'utf8')).version).toBe('1.0.0')
  })

  test('the next publication keeps release history and the complete latest main snapshot', () => {
    const repo = repository()
    const first = prepareRelease(repo.work, repo.sourceSha)
    if (!first.ready) throw new Error('Missing first candidate')
    publishRelease(repo.work, first.candidate)
    const firstRelease = git(repo.remote, 'rev-parse', 'release')
    const nextSource = changeMain(repo.work)
    const next = prepareRelease(repo.work, nextSource)
    if (!next.ready) throw new Error('Missing next candidate')
    expect(next.candidate.version).toBe('1.0.1')
    expect(publishRelease(repo.work, next.candidate).published).toBe(true)
    expect(git(repo.remote, 'merge-base', '--is-ancestor', firstRelease, 'release')).toBe('')
    expect(git(repo.remote, 'show', 'release:app.txt')).toBe('new app')
    expect(git(repo.remote, 'show', 'main:package.json')).toContain('"version": "1.0.1"')
    expect(git(repo.remote, 'show', 'main:app.txt')).toBe('new app')
  })

  test('does not publish a prepared version if newer commits arrive on main', () => {
    const repo = repository()
    const status = prepareRelease(repo.work, repo.sourceSha)
    if (!status.ready) throw new Error('Missing release candidate')
    // A second clone sends another push while validation of the candidate is in progress.
    const other = join(repo.work, '..', 'other')
    git(repo.work, 'clone', '--quiet', repo.remote, other)
    git(other, 'config', 'user.name', 'Other test')
    git(other, 'config', 'user.email', 'other@example.test')
    git(other, 'config', 'commit.gpgsign', 'false')
    writeFileSync(join(other, 'app.txt'), 'another push\n')
    git(other, 'add', 'app.txt')
    git(other, 'commit', '--quiet', '-m', 'Consecutive push')
    git(other, 'push', '--quiet', 'origin', 'main')
    expect(publishRelease(repo.work, status.candidate).published).toBe(false)
    expect(git(repo.remote, 'ls-remote', '.', 'refs/heads/release')).toBe('')
  })

  test('rejects a concurrent modification of release without overwriting its history', () => {
    const repo = repository()
    const first = prepareRelease(repo.work, repo.sourceSha)
    if (!first.ready) throw new Error('Missing first candidate')
    publishRelease(repo.work, first.candidate)
    const nextSource = changeMain(repo.work)
    const next = prepareRelease(repo.work, nextSource)
    if (!next.ready) throw new Error('Missing next candidate')
    const other = join(repo.work, '..', 'other')
    git(repo.work, 'clone', '--quiet', repo.remote, other)
    git(other, 'config', 'user.name', 'Other test')
    git(other, 'config', 'user.email', 'other@example.test')
    git(other, 'config', 'commit.gpgsign', 'false')
    git(other, 'checkout', '--quiet', 'release')
    git(other, 'commit', '--quiet', '--allow-empty', '-m', 'Concurrent release change')
    git(other, 'push', '--quiet', 'origin', 'release')
    const concurrentHead = git(repo.remote, 'rev-parse', 'release')
    expect(() => publishRelease(repo.work, next.candidate)).toThrow('release ha cambiado')
    expect(git(repo.remote, 'rev-parse', 'release')).toBe(concurrentHead)
  })

  test('rejects a dirty checkout and unrelated changes introduced during validation', () => {
    const repo = repository()
    writeFileSync(join(repo.work, 'unrelated.txt'), 'keep this change\n')
    expect(() => prepareRelease(repo.work, repo.sourceSha)).toThrow('cambios locales')
    rmSync(join(repo.work, 'unrelated.txt'))
    const status = prepareRelease(repo.work, repo.sourceSha)
    if (!status.ready) throw new Error('Missing release candidate')
    writeFileSync(join(repo.work, 'app.txt'), 'unexpected modification\n')
    expect(() => publishRelease(repo.work, status.candidate)).toThrow('cambios locales')
    expect(git(repo.remote, 'ls-remote', '.', 'refs/heads/release')).toBe('')
  })

  test('rejects mismatching lockfile versions before writing either file', () => {
    const repo = repository()
    const lockPath = join(repo.work, 'package-lock.json')
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
    lock.packages[''].version = '0.9.0'
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
    git(repo.work, 'add', 'package-lock.json')
    git(repo.work, 'commit', '--quiet', '-m', 'Broken lockfile')
    git(repo.work, 'push', '--quiet', 'origin', 'main')
    expect(() => prepareRelease(repo.work, git(repo.work, 'rev-parse', 'HEAD'))).toThrow('misma versión')
    expect(JSON.parse(readFileSync(join(repo.work, 'package.json'), 'utf8')).version).toBe('1.0.0')
  })

  test('the CLI refuses to prepare releases outside GitHub Actions', () => {
    const repo = repository()
    const result = spawnSync(process.execPath, [join(process.cwd(), 'scripts/automaticRelease.ts'), 'prepare'], {
      cwd: repo.work, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'false', UNIZAR_SOURCE_SHA: repo.sourceSha },
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('solo se ejecuta desde GitHub Actions')
    expect(git(repo.work, 'status', '--porcelain')).toBe('')
  })

  test('runs the Actions CLI with Node 24 and passes the candidate between steps', () => {
    const repo = repository()
    const output = join(repo.work, '..', 'github-output')
    const env = { ...process.env, GITHUB_ACTIONS: 'true', UNIZAR_SOURCE_SHA: repo.sourceSha, GITHUB_OUTPUT: output }
    const run = (command: string, extra: Record<string, string> = {}) => spawnSync(process.execPath,
      [join(process.cwd(), 'scripts/automaticRelease.ts'), command], { cwd: repo.work, encoding: 'utf8', env: { ...env, ...extra } })
    expect(run('check').status).toBe(0)
    expect(readFileSync(output, 'utf8')).toContain('ready=true')
    expect(run('prepare').status).toBe(0)
    expect(readFileSync(output, 'utf8')).toContain('version=1.0.0\nprevious_release_sha=\n')
    expect(run('publish', { UNIZAR_RELEASE_VERSION: '1.0.0', UNIZAR_PREVIOUS_RELEASE_SHA: '' }).status).toBe(0)
    expect(JSON.parse(git(repo.remote, 'show', 'release:package.json')).version).toBe('1.0.0')
    expect(JSON.parse(git(repo.remote, 'show', 'main:package.json')).version).toBe('1.0.0')
    expect(git(repo.remote, 'show', 'main:app.txt')).toBe('initial app')
  })

  test('rechaza publicar código distinto sin haber incrementado la versión en el commit', () => {
    const repo = repository()
    const first = prepareRelease(repo.work, repo.sourceSha)
    if (!first.ready) throw new Error('Missing candidate')
    publishRelease(repo.work, first.candidate)
    writeFileSync(join(repo.work, 'app.txt'), 'unversioned change\n')
    git(repo.work, 'add', 'app.txt')
    git(repo.work, 'commit', '--quiet', '-m', 'Skipped version hook')
    git(repo.work, 'push', '--quiet', 'origin', 'main')
    expect(() => checkRelease(repo.work, git(repo.work, 'rev-parse', 'HEAD'))).toThrow('versión superior')
  })

  test('no vuelve a desplegar un commit que solo cambia el mensaje', () => {
    const repo = repository()
    const first = prepareRelease(repo.work, repo.sourceSha)
    if (!first.ready) throw new Error('Missing candidate')
    publishRelease(repo.work, first.candidate)
    git(repo.work, 'commit', '--quiet', '--allow-empty', '-m', 'Message only')
    git(repo.work, 'push', '--quiet', 'origin', 'main')
    expect(checkRelease(repo.work, git(repo.work, 'rev-parse', 'HEAD')).ready).toBe(false)
  })
})
