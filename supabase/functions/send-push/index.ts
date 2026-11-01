// Las credenciales viven en Secrets. Esta función solo recibe llamadas del Cron privado.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3'
import { generateRequestDetails, setVapidDetails } from 'npm:web-push@3.6.7'
import { allowedPushEndpoint, buildPushPayload } from './pushPayload.ts'
import type { PushDelivery } from './pushPayload.ts'

declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void }

// La comparación usa HMAC para no depender de la posición del primer byte distinto.
async function validSecret(received: string, expected: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(expected), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(expected))
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(received))
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const secret = Deno.env.get('PUSH_DISPATCH_SECRET')
  if (!secret || !await validSecret(request.headers.get('x-push-secret') ?? '', secret)) return new Response('Unauthorized', { status: 401 })
  const publicKey = Deno.env.get('WEB_PUSH_PUBLIC_KEY')
  const privateKey = Deno.env.get('WEB_PUSH_PRIVATE_KEY')
  const subject = Deno.env.get('WEB_PUSH_SUBJECT')
  if (!publicKey || !privateKey || !subject) return new Response('Missing push configuration', { status: 503 })
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  let sent = 0
  let failed = 0
  try {
    setVapidDetails(subject, publicKey, privateKey)
    // Lotes pequeños: máximo 30 cifrados por invocación y seis conexiones a la vez.
    const { data, error } = await client.rpc('claim_push_deliveries', { checked_limit: 30 })
    if (error) throw error
    const deliveries = (data ?? []) as PushDelivery[]
    for (let offset = 0; offset < deliveries.length; offset += 6) {
      await Promise.all(deliveries.slice(offset, offset + 6).map(async (delivery) => {
        let status: number
        if (!allowedPushEndpoint(delivery.endpoint)) status = 400
        else {
          try {
            const ttl = Math.max(0, Math.min(86400, Math.floor((Date.parse(delivery.expires_at) - Date.now()) / 1000)))
            if (ttl <= 0) status = 400
            else {
              const details = generateRequestDetails({ endpoint: delivery.endpoint, keys: { p256dh: delivery.p256dh, auth: delivery.auth_key } },
                JSON.stringify(buildPushPayload(delivery)), { TTL: ttl, urgency: 'normal', contentEncoding: 'aes128gcm' })
              const response = await fetch(delivery.endpoint, {
                method: 'POST', headers: details.headers, body: new Uint8Array(details.body),
                redirect: 'error', signal: AbortSignal.timeout(12000),
              })
              status = response.status
              await response.body?.cancel()
            }
          } catch { status = 0 }
        }
        if (status >= 200 && status < 300) sent += 1
        else failed += 1
        const { error: finishError } = await client.rpc('finish_push_delivery', {
          checked_delivery: delivery.delivery_id, checked_lease: delivery.lease, checked_status: status,
        })
        if (finishError) throw finishError
      }))
    }
    // Solo contadores; nunca endpoints, claves, cuerpos o datos de las jugadoras.
    return Response.json({ processed: deliveries.length, sent, failed })
  } catch {
    return Response.json({ error: 'No se ha podido procesar el lote de notificaciones.' }, { status: 500 })
  }
})
