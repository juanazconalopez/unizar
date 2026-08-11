import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const projectId = process.env.SUPABASE_PROJECT_ID
const sourceArgs = projectId ? ['--project-id', projectId] : ['--local']
const result = spawnSync(
  'supabase',
  ['gen', 'types', 'typescript', ...sourceArgs, '--schema', 'public'],
  { encoding: 'utf8', env: process.env },
)

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout)
  process.exit(result.status ?? 1)
}

const target = resolve('src/lib/database.types.ts')
writeFileSync(target, result.stdout)
process.stdout.write(`Tipos de Supabase actualizados en ${target}\n`)
