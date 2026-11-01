import { describe, expect, test } from 'vitest'
import { allowedPushEndpoint, buildPushPayload } from './pushPayload'
import type { PushDelivery } from './pushPayload'

describe('destinos y privacidad de Web Push', () => {
  test.each([
    'https://fcm.googleapis.com/fcm/send/token', 'https://updates.push.services.mozilla.com/wpush/v2/token',
    'https://web.push.apple.com/Qtoken', 'https://wns2.notify.windows.com/token',
  ])('acepta el servicio push %s', (endpoint) => { expect(allowedPushEndpoint(endpoint)).toBe(true) })

  test.each([
    'http://fcm.googleapis.com/token', 'https://fcm.googleapis.com.evil.test/token', 'https://127.0.0.1/token',
    'https://fcm.googleapis.com@evil.test/token', 'https://evil@fcm.googleapis.com/token',
    'https://fcm.googleapis.com:8443/token', 'https://fcm.googleapis.com/token#fragment',
  ])('rechaza el destino arbitrario %s', (endpoint) => { expect(allowedPushEndpoint(endpoint)).toBe(false) })

  test('el mensaje no incluye endpoint, claves ni datos de otras personas', () => {
    const delivery: PushDelivery = {
      delivery_id: 1, lease: 'lease', endpoint: 'private-endpoint', p256dh: 'secret-key', auth_key: 'secret-auth', user_id: 'player-1',
      event_id: 'event-1', kind: 'announcement', target_date: '2026-11-12', source_id: 'notice-1', target_view: 'calendar', expires_at: '2026-11-13T00:00:00Z',
    }
    expect(buildPushPayload(delivery)).toEqual({
      eventId: 'event-1', userId: 'player-1', title: 'Nuevo aviso del equipo', url: '/?view=calendar&date=2026-11-12&announcement=notice-1',
    })
    expect(buildPushPayload({ ...delivery, target_view: 'https://evil.test', target_date: 'bad-date' }).url).toBe('/?view=home&announcement=notice-1')
  })
})
