import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

export function appVersionPlugin(): Plugin {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  const source = JSON.stringify({ version })

  return {
    name: 'app-version',
    config: () => ({ define: { __APP_VERSION__: JSON.stringify(version) } }),
    configureServer(server) {
      server.middlewares.use('/version.json', (_request, response) => {
        response.setHeader('Content-Type', 'application/json')
        response.setHeader('Cache-Control', 'no-store')
        response.end(source)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source })
    },
  }
}
