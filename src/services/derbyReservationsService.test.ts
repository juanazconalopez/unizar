import { beforeEach, describe, expect, test, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }))
import { fetchDerbyReservedPlayers } from './derbyReservationsService'

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
