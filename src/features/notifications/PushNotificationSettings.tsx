import { useEffect, useState } from 'react'
import { DEFAULT_PUSH_TOPICS, pushTopicsForRole } from './pushTopics'
import type { PushTopic } from './pushTopics'
import type * as PushService from '../../services/pushNotificationsService'
import { errorText } from '../../lib/errors'

export function PushNotificationSettings({ userId, isPlayer, isStaff, demo = false }: {
  userId: string; isPlayer: boolean; isStaff: boolean; demo?: boolean
}) {
  const [service, setService] = useState<typeof PushService | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [topics, setTopics] = useState<PushTopic[]>(DEFAULT_PUSH_TOPICS)
  const [busy, setBusy] = useState(!demo)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const support = demo ? null : service?.pushSupportMessage()
  const options = pushTopicsForRole(isPlayer, isStaff)

  useEffect(() => {
    if (demo) return
    let cancelled = false
    void import('../../services/pushNotificationsService').then(async (api) => {
      if (cancelled) return
      setService(api)
      if (api.pushSupportMessage()) return
      const state = await api.getPushDeviceState(userId)
      if (!cancelled) { setEnabled(state.enabled); setTopics(state.topics) }
    }).catch((failure: unknown) => { if (!cancelled) setError(errorText(failure)) })
      .finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [demo, userId])

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setMessage('')
    try { await action(); setMessage(success) } catch (failure) { setError(errorText(failure)) } finally { setBusy(false) }
  }

  async function toggle() {
    await run(async () => {
      if (!demo) {
        if (!service) return
        if (enabled) await service.disablePush()
        else await service.enablePush(userId, topics)
      }
      setEnabled(!enabled)
    }, enabled ? 'Notificaciones desactivadas en este dispositivo.' : demo ? 'Activadas en la demo. No se enviarán notificaciones reales.' : 'Notificaciones activadas en este dispositivo.')
  }

  function updateTopic(key: PushTopic) {
    const next = topics.includes(key) ? topics.filter((topic) => topic !== key) : [...topics, key]
    void run(async () => {
      if (enabled && !demo) await service!.savePushTopics(userId, next)
      setTopics(next)
    }, 'Preferencias guardadas.')
  }

  return <section className="push-settings" aria-labelledby="push-settings-title">
    <h3 id="push-settings-title">Notificaciones en este dispositivo</h3>
    <p>Recibe los avisos del equipo aunque tengas la aplicación cerrada. La campana seguirá disponible.</p>
    {support && <p className="form-hint">{support}</p>}
    <button className="secondary-button" disabled={busy || (!demo && !service) || (Boolean(support) && !enabled)} onClick={() => void toggle()} type="button">
      {busy ? 'Preparando…' : enabled ? 'Desactivar notificaciones' : 'Activar notificaciones'}
    </button>
    {enabled && <>
      <fieldset disabled={busy}>
        <legend>Qué avisos quieres recibir</legend>
        {options.map((topic) => <label key={topic.key}><input checked={topics.includes(topic.key)} onChange={() => updateTopic(topic.key)} type="checkbox" />{topic.label}</label>)}
      </fieldset>
      <button className="text-button" disabled={busy} onClick={() => void run(async () => { if (!demo) await service!.sendPushTest(userId) }, demo ? 'Prueba simulada. La demo no envía notificaciones.' : 'Prueba solicitada. Debería llegar en los próximos cinco minutos.')} type="button">Enviar notificación de prueba</button>
    </>}
    {message && <p aria-live="polite" className="form-hint">{message}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>
}
