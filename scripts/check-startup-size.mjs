import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const buildDir = resolve('dist')
const manifest = JSON.parse(readFileSync(resolve(buildDir, '.vite/manifest.json'), 'utf8'))
const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry)
if (!entryKey) throw new Error('No se ha encontrado la entrada de la aplicación en el build.')

function staticGraph(keys) {
  const visited = new Set()
  function visit(key) {
    if (visited.has(key)) return
    const chunk = manifest[key]
    if (!chunk) throw new Error(`Falta el fragmento ${key} en el manifiesto.`)
    visited.add(key)
    for (const dependency of chunk.imports ?? []) visit(dependency)
  }
  keys.forEach(visit)
  const files = [...new Set([...visited].map((key) => manifest[key].file).filter((file) => file.endsWith('.js')))]
  return files.reduce((total, file) => {
    const bytes = readFileSync(resolve(buildDir, file))
    return { raw: total.raw + bytes.length, gzip: total.gzip + gzipSync(bytes).length, files: total.files + 1 }
  }, { raw: 0, gzip: 0, files: 0 })
}

function report(label, size) {
  process.stdout.write(`${label}: ${(size.raw / 1000).toFixed(1)} kB JS, ${(size.gzip / 1000).toFixed(1)} kB gzip (${size.files} archivos).\n`)
}

const startup = staticGraph([entryKey])
report('Arranque antes de cargar una sección', startup)
const homeKey = 'src/features/dashboard/Dashboard.tsx'
if (!manifest[homeKey]) throw new Error('Inicio debe seguir siendo una sección cargada bajo demanda.')
report('Arranque más Inicio y sus dependencias', staticGraph([entryKey, homeKey]))

// Presupuesto del arranque: no cuenta los fragmentos dinámicos, CSS, imágenes,
// respuestas de Supabase ni la compresión que finalmente aplique el servidor.
if (startup.raw > 600_000 || startup.gzip > 180_000) {
  process.stderr.write('El JavaScript de arranque supera el presupuesto de 600 kB / 180 kB gzip.\n')
  process.exitCode = 1
}
