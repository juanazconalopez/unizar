import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
const api = vi.hoisted(() => ({
  pushSupportMessage: vi.fn(), getPushDeviceState: vi.fn(), enablePush: vi.fn(), disablePush: vi.fn(), savePushTopics: vi.fn(), sendPushTest: vi.fn(),
}))
vi.mock('../../services/pushNotificationsService', () => api)
import { PushNotificationSettings } from './PushNotificationSettings'

describe('preferencias de notificaciones', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    api.getPushDeviceState.mockResolvedValue({ enabled: false, topics: ['matches', 'lineups'] })
    api.enablePush.mockResolvedValue(undefined)
    api.savePushTopics.mockResolvedValue(undefined)
  })

  test('solo activa las push al pulsar el botón y permite guardar preferencias', async () => {
    render(<PushNotificationSettings userId="player-1" isPlayer isStaff={false} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Activar notificaciones' })).toBeEnabled())
    expect(api.enablePush).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Activar notificaciones' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Desactivar notificaciones' })).toBeEnabled())
    expect(api.enablePush).toHaveBeenCalledWith('player-1', ['matches', 'lineups'])
    fireEvent.click(screen.getByLabelText('Publicación y cambios de convocatorias'))
    await waitFor(() => expect(api.savePushTopics).toHaveBeenCalledWith('player-1', ['matches']))
    expect(screen.queryByLabelText('Resumen de disponibilidad para el staff')).not.toBeInTheDocument()
  })

  test('muestra fallos de carga sin ofrecer un estado activo inventado', async () => {
    api.getPushDeviceState.mockRejectedValue(new Error('No se han podido cargar las preferencias'))
    render(<PushNotificationSettings userId="player-1" isPlayer isStaff={false} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se han podido cargar')
    expect(screen.queryByRole('button', { name: 'Enviar notificación de prueba' })).not.toBeInTheDocument()
  })

  test('la demo simula activación y prueba sin llamar al servidor ni pedir permisos', async () => {
    render(<PushNotificationSettings userId="demo" isPlayer isStaff demo />)
    fireEvent.click(screen.getByRole('button', { name: 'Activar notificaciones' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Enviar notificación de prueba' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Enviar notificación de prueba' }))
    expect(await screen.findByText('Prueba simulada. La demo no envía notificaciones.')).toBeInTheDocument()
    expect(api.getPushDeviceState).not.toHaveBeenCalled()
    expect(api.enablePush).not.toHaveBeenCalled()
    expect(api.sendPushTest).not.toHaveBeenCalled()
  })
})
