import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchDerbyReservedPlayers } from '../services/derbyReservationsService'
import { useDerbyReservedPlayers } from './useDerbyReservedPlayers'

vi.mock('../services/derbyReservationsService', () => ({ fetchDerbyReservedPlayers: vi.fn() }))
const fetchReservations = vi.mocked(fetchDerbyReservedPlayers)

describe('useDerbyReservedPlayers', () => {
  beforeEach(() => { fetchReservations.mockReset() })

  test('no consulta partidos externos, convocatorias de consulta ni la demo', () => {
    const { result } = renderHook(() => useDerbyReservedPlayers('match', false))
    expect(result.current).toEqual({ playerIds: [], loading: false, error: undefined })
    expect(fetchReservations).not.toHaveBeenCalled()
  })

  test('carga reservas guardadas del otro equipo aunque su borrador no sea visible', async () => {
    fetchReservations.mockResolvedValue(['starter', 'substitute'])
    const { result } = renderHook(() => useDerbyReservedPlayers('match', true))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.playerIds).toEqual(['starter', 'substitute']))
    expect(result.current.loading).toBe(false)
    expect(fetchReservations).toHaveBeenCalledWith('match')
  })

  test('informa del fallo para impedir seleccionar jugadoras con reservas sin comprobar', async () => {
    fetchReservations.mockRejectedValue({ message: 'Sin conexión' })
    const { result } = renderHook(() => useDerbyReservedPlayers('match', true))
    await waitFor(() => expect(result.current.error).toBe('Sin conexión'))
    expect(result.current.playerIds).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  test('una respuesta anterior no sobrescribe las reservas del nuevo partido', async () => {
    let resolvePrevious!: (ids: string[]) => void
    fetchReservations.mockReturnValueOnce(new Promise((resolve) => { resolvePrevious = resolve })).mockResolvedValueOnce(['current'])
    const { result, rerender } = renderHook(({ id }) => useDerbyReservedPlayers(id, true), { initialProps: { id: 'previous' } })
    rerender({ id: 'current' })
    await waitFor(() => expect(result.current.playerIds).toEqual(['current']))
    await act(async () => resolvePrevious(['outdated']))
    expect(result.current.playerIds).toEqual(['current'])
  })
})
