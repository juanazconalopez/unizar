import { createECDH, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const ecdh = createECDH('prime256v1')
ecdh.generateKeys()
const output = 'web-push-secrets.local'
writeFileSync(output, [
  '# Solo para Supabase Secrets. Completa WEB_PUSH_SUBJECT con un mailto: de contacto real o una URL pública.',
  `WEB_PUSH_PUBLIC_KEY=${ecdh.getPublicKey().toString('base64url')}`,
  `WEB_PUSH_PRIVATE_KEY=${ecdh.getPrivateKey().toString('base64url')}`,
  `PUSH_DISPATCH_SECRET=${randomBytes(32).toString('base64url')}`,
  'WEB_PUSH_SUBJECT=',
  '',
].join('\n'), { encoding: 'utf8', flag: 'wx', mode: 0o600 })
console.log(`Claves guardadas en ${output}, ignorado por Git y con permisos 600. No se han mostrado secretos.`)
console.log('Completa WEB_PUSH_SUBJECT. Copia únicamente WEB_PUSH_PUBLIC_KEY a VITE_WEB_PUSH_PUBLIC_KEY para el frontend.')
