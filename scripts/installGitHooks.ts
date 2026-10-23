import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function installGitHooks(directory: string): boolean {
  if (!existsSync(resolve(directory, '.git'))) return false
  const configured = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: directory, encoding: 'utf8' })
  if (configured.error) throw configured.error
  if (configured.status !== 0 && configured.status !== 1) throw new Error('No se ha podido consultar la configuración de hooks.')
  const hooksPath = configured.stdout.trim()
  if (hooksPath && resolve(directory, hooksPath) !== resolve(directory, '.githooks')) {
    throw new Error('Ya existe otro core.hooksPath. Se conserva su configuración; integra el hook de versión antes de activarlo.')
  }
  for (const hook of ['pre-commit', 'post-commit']) {
    const existingHook = execFileSync('git', ['rev-parse', '--git-path', `hooks/${hook}`], { cwd: directory, encoding: 'utf8' }).trim()
    if (!hooksPath && existsSync(resolve(directory, existingHook))) {
      throw new Error(`Ya existe un ${hook} local. Se conserva; integra el hook de versión antes de activarlo.`)
    }
    chmodSync(resolve(directory, `.githooks/${hook}`), 0o755)
  }
  execFileSync('git', ['config', '--local', 'core.hooksPath', '.githooks'], { cwd: directory, stdio: 'pipe' })
  return true
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (!process.env.CI && installGitHooks(process.cwd())) console.log('Versionado automático antes del commit activado.')
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'No se han podido instalar los hooks.')
    process.exitCode = 1
  }
}
