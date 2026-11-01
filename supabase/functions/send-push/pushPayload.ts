export type PushDelivery = {
  delivery_id: number
  lease: string
  endpoint: string
  p256dh: string
  auth_key: string
  user_id: string
  event_id: string
  kind: string
  target_date: string | null
  source_id: string | null
  target_view: string
  expires_at: string
}

const TITLES: Record<string, string> = {
  match_published: 'Nuevo partido publicado',
  match_changed: 'Cambio importante en un partido',
  lineup: 'Convocatoria publicada o actualizada',
  announcement: 'Nuevo aviso del equipo',
  training_group: 'Tu grupo de entrenamiento está publicado',
  availability_reminder: 'Recuerda responder tu disponibilidad',
  availability_digest: 'Resumen de cambios de disponibilidad',
  training_changed: 'Cambio o cancelación de un entrenamiento',
  training_reminder: 'Recuerda responder al entrenamiento de hoy',
  test: 'Las notificaciones de CDU Rugby funcionan',
}

/** Nunca se utilizan endpoints arbitrarios ni redirecciones al enviar credenciales. */
export function allowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value)
    return value.length <= 2048 && url.protocol === 'https:' && !url.username && !url.password && !url.port
      && url.pathname.length > 1 && !url.hash
      && (url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com'
        || /^[a-z0-9-]+\.push\.apple\.com$/.test(url.hostname)
        || /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname))
  } catch { return false }
}

export function buildPushPayload(delivery: PushDelivery) {
  const view = ['home', 'calendar', 'matches', 'training-groups'].includes(delivery.target_view) ? delivery.target_view : 'home'
  const query = new URLSearchParams({ view })
  if (delivery.target_date && /^\d{4}-\d{2}-\d{2}$/.test(delivery.target_date)) query.set('date', delivery.target_date)
  if (delivery.kind === 'announcement' && delivery.source_id) query.set('announcement', delivery.source_id)
  return {
    eventId: delivery.event_id,
    userId: delivery.user_id,
    title: TITLES[delivery.kind] ?? 'Nuevo aviso de CDU Rugby',
    url: `/?${query}`,
  }
}
