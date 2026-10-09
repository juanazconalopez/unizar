import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchMatchLineupReservations } from '../services/derbyReservationsService'
import type { MatchLineupReservation } from '../lib/matchParticipation'
import { useMatchLineupReservations } from './useMatchLineupReservations'

vi.mock('../services/derbyReservationsService', () => ({ fetchMatchLineupReservations: vi.fn() }))
const reservation = (id: string): MatchLineupReservation => ({ player_id: id, match_id: 'other', team_name: 'Unizar B', match_date: '2026-10-18', is_derby: false })
const fetchReservations = vi.mocked(fetchMatchLineupReservations)

describe('useMatchLineupReservations', () => {
  beforeEach(() => { fetchReservations.mockReset() })

  test('no consulta convocatorias de lectura ni la demo', () => {
    const { result } = renderHook(() => useMatchLineupReservations('match', false))
    expect(result.current).toEqual({ reservations: [], loading: false, error: undefined })
    expect(fetchReservations).not.toHaveBeenCalled()
  })

  test('carga reservas guardadas del otro equipo aunque su borrador no sea visible', async () => {
    fetchReservations.mockResolvedValue([reservation('starter'), reservation('substitute')])
    const { result } = renderHook(() => useMatchLineupReservations('match', true))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.reservations).toEqual([reservation('starter'), reservation('substitute')]))
    expect(result.current.loading).toBe(false)
    expect(fetchReservations).toHaveBeenCalledWith('match')
  })

  test('informa del fallo para impedir seleccionar jugadoras con reservas sin comprobar', async () => {
    fetchReservations.mockRejectedValue({ message: 'Sin conexión' })
    const { result } = renderHook(() => useMatchLineupReservations('match', true))
    await waitFor(() => expect(result.current.error).toBe('Sin conexión'))
    expect(result.current.reservations).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  test('una respuesta anterior no sobrescribe las reservas del nuevo partido', async () => {
    let resolvePrevious!: (ids: MatchLineupReservation[]) => void
    fetchReservations.mockReturnValueOnce(new Promise((resolve) => { resolvePrevious = resolve })).mockResolvedValueOnce([reservation('current')])
    const { result, rerender } = renderHook(({ id }) => useMatchLineupReservations(id, true), { initialProps: { id: 'previous' } })
    rerender({ id: 'current' })
    await waitFor(() => expect(result.current.reservations).toEqual([reservation('current')]))
    await act(async () => resolvePrevious([reservation('outdated')]))
    expect(result.current.reservations).toEqual([reservation('current')])
  })

  test('volver a editar exige una consulta nueva aunque sea el mismo partido', async () => {
    let resolve!: (ids: MatchLineupReservation[]) => void
    fetchReservations.mockResolvedValueOnce([]).mockReturnValueOnce(new Promise((done) => { resolve = done }))
    const { result, rerender } = renderHook(({ enabled }) => useMatchLineupReservations('match', enabled), { initialProps: { enabled: true } })
    await waitFor(() => expect(result.current.loading).toBe(false))
    rerender({ enabled: false })
    rerender({ enabled: true })
    expect(result.current.loading).toBe(true)
    await act(async () => resolve([reservation('reserved')]))
    expect(result.current.reservations).toEqual([reservation('reserved')])
  })
})
