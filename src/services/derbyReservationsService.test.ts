import { beforeEach, describe, expect, test, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }))
import { fetchDerbyReservedPlayers, fetchMatchLineupReservations } from './derbyReservationsService'

describe('fetchDerbyReservedPlayers', () => {
  beforeEach(() => { rpc.mockReset() })
  test('consulta solo identificadores reservados mediante la RPC protegida', async () => {
    rpc.mockResolvedValue({ data: ['starter', 'substitute'], error: null })
    await expect(fetchDerbyReservedPlayers('match-b')).resolves.toEqual(['starter', 'substitute'])
    expect(rpc).toHaveBeenCalledWith('get_derby_reserved_player_ids', { checked_match_id: 'match-b' })
  })
  test('propaga fallos de permisos o conexión', async () => {
    const error = { message: 'Sin permiso' }
    rpc.mockResolvedValue({ data: null, error })
    await expect(fetchDerbyReservedPlayers('match')).rejects.toEqual(error)
  })
  test('rechaza una respuesta incompleta en vez de considerar todas las jugadoras libres', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(fetchDerbyReservedPlayers('match')).rejects.toThrow(/comprobar/)
  })
})

describe('fetchMatchLineupReservations', () => {
  beforeEach(() => { rpc.mockReset() })
  test('consulta reservas de la ventana, sin dorsales ni borradores completos', async () => {
    const reservations = [{ player_id: 'player', match_id: 'other', team_name: 'Unizar B', match_date: '2026-10-18', is_derby: false }]
    rpc.mockResolvedValue({ data: reservations, error: null })
    await expect(fetchMatchLineupReservations('saturday')).resolves.toEqual(reservations)
    expect(rpc).toHaveBeenCalledWith('get_match_lineup_reservations', { checked_match_id: 'saturday' })
  })
  test.each([null, ['player'], [{ player_id: 'player', is_derby: false }]])('rechaza reservas incompletas: %j', async (data) => {
    rpc.mockResolvedValue({ data, error: null })
    await expect(fetchMatchLineupReservations('match')).rejects.toThrow(/comprobar/)
  })
  test('propaga el error y no considera libres a las jugadoras', async () => {
    const error = { message: 'Sin permiso' }
    rpc.mockResolvedValue({ data: null, error })
    await expect(fetchMatchLineupReservations('match')).rejects.toEqual(error)
  })
})
