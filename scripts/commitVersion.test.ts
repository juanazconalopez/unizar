import { execFileSync } from 'node:child_process'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { updateCommitVersion } from './commitVersion.ts'
import { installGitHooks } from './installGitHooks.ts'
import { nextCommitVersion } from './packageVersions.ts'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function git(directory: string, ...args: string[]) {
  return execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: 'pipe' }).trim()
}

function repository() {
  const directory = mkdtempSync(join(tmpdir(), 'unizar-commit-version-'))
  directories.push(directory)
  git(directory, 'init', '--quiet', '--initial-branch=main')
  git(directory, 'config', 'user.name', 'Version test')
  git(directory, 'config', 'user.email', 'version@example.test')
  git(directory, 'config', 'commit.gpgsign', 'false')
  mkdirSync(join(directory, 'scripts'))
  mkdirSync(join(directory, '.githooks'))
  for (const file of ['scripts/commitVersion.ts', 'scripts/packageVersions.ts', '.githooks/pre-commit', '.githooks/post-commit', '.nvmrc']) {
    copyFileSync(join(process.cwd(), file), join(directory, file))
  }
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ name: 'version-test', type: 'module', version: '1.2.3' }, null, 2) + '\n')
  writeFileSync(join(directory, 'package-lock.json'), JSON.stringify({ name: 'version-test', version: '1.2.3', lockfileVersion: 3, packages: { '': { version: '1.2.3' } } }, null, 2) + '\n')
  writeFileSync(join(directory, 'app.txt'), 'initial\n')
  writeFileSync(join(directory, 'other.txt'), 'unrelated\n')
  git(directory, 'add', '.')
  git(directory, 'commit', '--quiet', '-m', 'Initial')
  return directory
}

function stageChange(directory: string, content = 'changed\n') {
  writeFileSync(join(directory, 'app.txt'), content)
  git(directory, 'add', 'app.txt')
}

function versions(directory: string, revision?: string) {
  const read = (file: string) => JSON.parse(revision ? git(directory, 'show', `${revision}:${file}`) : readFileSync(join(directory, file), 'utf8'))
  const pkg = read('package.json')
  const lock = read('package-lock.json')
  return [pkg.version, lock.version, lock.packages[''].version]
}

describe('versión automática antes del commit', () => {
  test.each([
    ['1.0.0', '1.0.0', '1.0.1'],
    ['1.0.9', '1.0.9', '1.0.10'],
    ['1.1.0', '1.0.9', '1.1.0'],
    ['2.0.0', '1.9.99', '2.0.0'],
    ['1.0.0', null, '1.0.0'],
  ])('usa %s con HEAD %s para preparar %s', (current, previous, expected) => {
    expect(nextCommitVersion(current, previous)).toBe(expected)
  })

  test.each(['1.0', '1.0.1-beta', '01.0.0', '1.0.9007199254740992'])('rechaza la versión no soportada %s', (version) => {
    expect(() => nextCommitVersion(version, '1.0.0')).toThrow('Versión no válida')
  })

  test('rechaza reducir la versión de HEAD', () => {
    expect(() => nextCommitVersion('1.0.0', '1.0.9')).toThrow('inferior')
  })

  test('el hook real incorpora ambos archivos al mismo commit y conserva los cambios no preparados', () => {
    const directory = repository()
    installGitHooks(directory)
    stageChange(directory)
    writeFileSync(join(directory, 'other.txt'), 'keep this change\n')
    git(directory, 'commit', '--quiet', '-m', 'Change app')
    expect(versions(directory, 'HEAD')).toEqual(['1.2.4', '1.2.4', '1.2.4'])
    expect(git(directory, 'show', 'HEAD:other.txt')).toBe('unrelated')
    expect(readFileSync(join(directory, 'other.txt'), 'utf8')).toBe('keep this change\n')
    expect(git(directory, 'diff', '--cached', '--name-only')).toBe('')
    stageChange(directory, 'second change\n')
    git(directory, 'commit', '--quiet', '-m', 'Second change')
    expect(versions(directory, 'HEAD')).toEqual(['1.2.5', '1.2.5', '1.2.5'])
  })

  test('reintentar un commit fallido conserva la versión ya preparada', () => {
    const directory = repository()
    installGitHooks(directory)
    stageChange(directory)
    const rejectHook = join(directory, '.githooks/commit-msg')
    writeFileSync(rejectHook, '#!/bin/sh\nexit 1\n')
    chmodSync(rejectHook, 0o755)
    expect(() => git(directory, 'commit', '--quiet', '-m', 'Rejected')).toThrow()
    expect(versions(directory)).toEqual(['1.2.4', '1.2.4', '1.2.4'])
    expect(versions(directory, 'HEAD')).toEqual(['1.2.3', '1.2.3', '1.2.3'])
    rmSync(rejectHook)
    git(directory, 'commit', '--quiet', '-m', 'Retry')
    expect(versions(directory, 'HEAD')).toEqual(['1.2.4', '1.2.4', '1.2.4'])
  })

  test('el commit de un editor gráfico carga nvm cuando recibe un Node antiguo y NVM_DIR no está definido', () => {
    const directory = repository()
    installGitHooks(directory)
    stageChange(directory)
    const fakeHome = join(directory, 'gui-home')
    const fakeBin = join(directory, 'gui-bin')
    mkdirSync(join(fakeHome, '.nvm'), { recursive: true })
    mkdirSync(fakeBin)
    writeFileSync(join(fakeBin, 'node'), '#!/bin/sh\n[ "$1" = "--version" ] && { echo v16.20.0; exit 0; }\nexit 1\n')
    chmodSync(join(fakeBin, 'node'), 0o755)
    // Bajo /bin/sh, nvm necesita su carpeta explícita antes de cargar nvm.sh.
    writeFileSync(join(fakeHome, '.nvm/nvm.sh'), '[ "${NVM_DIR-}" = "$HOME/.nvm" ] || return 3\nnvm() { export PATH="$UNIZAR_TEST_NODE_BIN:$PATH"; }\n')
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: fakeHome, PATH: `${fakeBin}${delimiter}${process.env.PATH ?? ''}`, UNIZAR_TEST_NODE_BIN: dirname(process.execPath) }
    delete env.NVM_DIR
    delete env.NVM_BIN
    execFileSync('git', ['-c', 'user.useConfigOnly=true', 'commit', '--quiet', '--allow-empty-message', '--file', '-'], {
      cwd: directory, env, input: 'Commit desde el editor\n', encoding: 'utf8', stdio: 'pipe',
    })
    expect(versions(directory, 'HEAD')).toEqual(['1.2.4', '1.2.4', '1.2.4'])
    expect(git(directory, 'diff', '--cached', '--name-only')).toBe('')
  })

  test('incluye la versión en un commit con rutas concretas y conserva el índice de otros archivos', () => {
    const directory = repository()
    installGitHooks(directory)
    stageChange(directory)
    writeFileSync(join(directory, 'other.txt'), 'staged for later\n')
    git(directory, 'add', 'other.txt')
    git(directory, 'commit', '--quiet', '-m', 'Only app', '--only', 'app.txt')
    expect(versions(directory, 'HEAD')).toEqual(['1.2.4', '1.2.4', '1.2.4'])
    expect(git(directory, 'show', 'HEAD:other.txt')).toBe('unrelated')
    expect(git(directory, 'diff', '--cached', '--name-only')).toBe('other.txt')
    stageChange(directory, 'amended change\n')
    git(directory, 'commit', '--quiet', '--amend', '--no-edit', '--only', 'app.txt')
    expect(versions(directory, 'HEAD')).toEqual(['1.2.5', '1.2.5', '1.2.5'])
    expect(git(directory, 'diff', '--cached', '--name-only')).toBe('other.txt')
  })

  test('no prepara automáticamente cambios de dependencias que estaban fuera del índice', () => {
    const directory = repository()
    stageChange(directory)
    const path = join(directory, 'package.json')
    const contents = readFileSync(path, 'utf8')
    writeFileSync(path, contents.replace('version-test', 'unstaged-name'))
    expect(() => updateCommitVersion(directory)).toThrow('cambios sin preparar')
    expect(git(directory, 'diff', '--cached', '--name-only')).toBe('app.txt')
    expect(git(directory, 'show', ':package.json')).toContain('version-test')
    expect(versions(directory)).toEqual(['1.2.3', '1.2.3', '1.2.3'])
  })

  test('no cambia nada si las versiones no coinciden o si no hay cambios preparados', () => {
    const directory = repository()
    expect(updateCommitVersion(directory)).toBeNull()
    stageChange(directory)
    const path = join(directory, 'package-lock.json')
    writeFileSync(path, readFileSync(path, 'utf8').replace('1.2.3', '1.2.2'))
    git(directory, 'add', 'package-lock.json')
    expect(() => updateCommitVersion(directory)).toThrow('misma versión')
    expect(JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')).version).toBe('1.2.3')
  })

  test('conserva una subida manual de minor en el commit', () => {
    const directory = repository()
    installGitHooks(directory)
    for (const file of ['package.json', 'package-lock.json']) {
      const path = join(directory, file)
      writeFileSync(path, readFileSync(path, 'utf8').replaceAll('1.2.3', '1.3.0'))
    }
    git(directory, 'add', 'package.json', 'package-lock.json')
    git(directory, 'commit', '--quiet', '-m', 'Minor')
    expect(versions(directory, 'HEAD')).toEqual(['1.3.0', '1.3.0', '1.3.0'])
  })

  test('la instalación es repetible y no sustituye otros hooks configurados', () => {
    const directory = repository()
    expect(installGitHooks(directory)).toBe(true)
    expect(installGitHooks(directory)).toBe(true)
    git(directory, 'config', 'core.hooksPath', 'custom-hooks')
    expect(() => installGitHooks(directory)).toThrow('otro core.hooksPath')
    expect(git(directory, 'config', '--get', 'core.hooksPath')).toBe('custom-hooks')
  })

  test('conserva un pre-commit local existente', () => {
    const directory = repository()
    const path = join(directory, '.git/hooks/pre-commit')
    writeFileSync(path, '#!/bin/sh\nexit 0\n')
    expect(() => installGitHooks(directory)).toThrow('pre-commit local')
    expect(readFileSync(path, 'utf8')).toBe('#!/bin/sh\nexit 0\n')
  })
})
