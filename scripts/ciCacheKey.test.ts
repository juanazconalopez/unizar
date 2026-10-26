import { describe, expect, test } from 'vitest'
import { dependencyFingerprint } from './ciCacheKey.ts'

function lockfile() {
  return {
    name: 'unizar', version: '1.0.0', lockfileVersion: 3,
    packages: {
      '': { version: '1.0.0', devDependencies: { eslint: '^10.0.0' } },
      'node_modules/eslint': { version: '10.0.0', integrity: 'sha512-original' },
    },
  }
}

describe('clave de dependencias para las cachés de CI', () => {
  test.each(['1.0.1', '1.1.0', '2.0.0'])('reutiliza la caché al subir solo la versión de la aplicación a %s', (version) => {
    const original = lockfile()
    const next = lockfile()
    next.version = version
    next.packages[''].version = version
    expect(dependencyFingerprint(JSON.stringify(next))).toBe(dependencyFingerprint(JSON.stringify(original)))
  })

  test('invalida la caché cuando cambia una dependencia instalada', () => {
    const original = lockfile()
    const next = lockfile()
    next.packages['node_modules/eslint'].version = '10.1.0'
    expect(dependencyFingerprint(JSON.stringify(next))).not.toBe(dependencyFingerprint(JSON.stringify(original)))
  })

  test('invalida la caché cuando cambia la integridad de un paquete', () => {
    const original = lockfile()
    const next = lockfile()
    next.packages['node_modules/eslint'].integrity = 'sha512-distinta'
    expect(dependencyFingerprint(JSON.stringify(next))).not.toBe(dependencyFingerprint(JSON.stringify(original)))
  })

  test('invalida la caché cuando cambia el rango declarado de una dependencia', () => {
    const original = lockfile()
    const next = lockfile()
    next.packages[''].devDependencies.eslint = '^10.1.0'
    expect(dependencyFingerprint(JSON.stringify(next))).not.toBe(dependencyFingerprint(JSON.stringify(original)))
  })
})
