type PackageJson = { version: string; [key: string]: unknown }
type PackageLock = PackageJson & { packages: Record<string, { version?: string; [key: string]: unknown }> }

function versionParts(version: string): number[] {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error(`Versión no válida: ${version}`)
  const parts = version.split('.').map(Number)
  if (parts.some((part) => !Number.isSafeInteger(part))) throw new Error(`Versión no válida: ${version}`)
  return parts
}

export function compareVersions(left: string, right: string): number {
  const a = versionParts(left)
  const b = versionParts(right)
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1
  }
  return 0
}

export function packageVersion(contents: string): string {
  const data = JSON.parse(contents) as { version?: unknown }
  if (typeof data.version !== 'string') throw new Error('Falta la versión de package.json.')
  versionParts(data.version)
  return data.version
}

export function readPackageVersions(packageContents: string, lockContents: string) {
  const pkg = JSON.parse(packageContents) as PackageJson
  const lock = JSON.parse(lockContents) as PackageLock
  const version = packageVersion(packageContents)
  if (lock.version !== version || lock.packages?.['']?.version !== version) {
    throw new Error('package.json y package-lock.json deben tener la misma versión.')
  }
  return { pkg, lock, version }
}

export function nextCommitVersion(current: string, previous: string | null): string {
  const parts = versionParts(current)
  if (previous === null || compareVersions(current, previous) > 0) return current
  if (compareVersions(current, previous) < 0) throw new Error('La versión del commit no puede ser inferior a la de HEAD.')
  if (!Number.isSafeInteger(parts[2] + 1)) throw new Error('No se puede incrementar la versión.')
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`
}
