import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { SessionQueryCache } from '../services/sessionQueryCache'
import type { TrainingPlanCalendarItem } from '../types'
import { useCalendarTrainings } from './useCalendarTrainings'
const plan: TrainingPlanCalendarItem = { id: 'oct', title: 'Octubre', session_date: '2026-10-23', status: 'draft' }
test('una respuesta de un mes anterior no sustituye el mes seleccionado', async () => {
  let finish!: (plans: TrainingPlanCalendarItem[]) => void
  const loader = vi.fn().mockImplementationOnce(() => new Promise<TrainingPlanCalendarItem[]>((resolve) => { finish = resolve })).mockResolvedValue([{ ...plan, id: 'nov', title: 'Noviembre', session_date: '2026-11-03' }])
  const { result, rerender } = renderHook(({ month }) => useCalendarTrainings(month, loader), { initialProps: { month: '2026-10-01' } })
  await waitFor(() => expect(loader).toHaveBeenCalledTimes(1))
  rerender({ month: '2026-11-01' })
  await waitFor(() => expect(result.current.plans[0]?.title).toBe('Noviembre'))
  await act(async () => { finish([plan]) })
  expect(result.current.plans[0]?.title).toBe('Noviembre')
})
test('muestra la caché de sesión inmediatamente y solo invalida los recursos de entrenamiento', async () => {
  const resources = new SessionQueryCache()
  await resources.load('training-calendar:2026-10-01', async () => [plan])
  await resources.load('training-group-state:season', async () => ['rojo'])
  await resources.load('managed-surveys', async () => ['encuesta'])
  const loader = vi.fn().mockResolvedValue([])
  const { result } = renderHook(() => useCalendarTrainings('2026-10-01', loader, undefined, resources))
  expect(result.current.plans).toEqual([plan])
  await act(async () => { await result.current.reload() })
  expect(loader).not.toHaveBeenCalled()
  resources.invalidatePrefix('training-calendar:')
  expect(resources.peek('training-group-state:season')).toEqual(['rojo'])
  expect(resources.peek('managed-surveys')).toEqual(['encuesta'])
  await act(async () => { await result.current.reload() })
  expect(loader).toHaveBeenCalledTimes(1)
})

test.each([
  [null, true, 5, 6],
  [false, true, 5, 6],
  [true, false, 5, 4],
  [true, true, 5, 5],
  [false, false, 0, 0],
  [true, false, 0, 0],
] as const)('actualiza el contador de %s a %s incluso si falla el refresco posterior', async (previous, attending, count, expected) => {
  const loader = vi.fn().mockResolvedValueOnce([{ ...plan, own_attending: previous, attending_count: count }]).mockRejectedValue(new Error('Sin conexión al refrescar'))
  const save = vi.fn().mockResolvedValue(undefined)
  const { result } = renderHook(() => useCalendarTrainings('2026-10-01', loader, save))
  await waitFor(() => expect(result.current.plans).toHaveLength(1))
  await act(async () => { await result.current.respond!(result.current.plans[0], attending, 'Comentario actualizado') })
  expect(result.current.plans[0].attending_count).toBe(expected)
  expect(result.current.plans[0].own_attending).toBe(attending)
})

test('no aumenta el contador si no se ha podido guardar la respuesta', async () => {
  const loaded = { ...plan, attending_count: 5, own_attending: null }
  const loader = vi.fn().mockResolvedValue([loaded])
  const save = vi.fn().mockRejectedValue(new Error('Respuesta cerrada'))
  const { result } = renderHook(() => useCalendarTrainings('2026-10-01', loader, save))
  await waitFor(() => expect(result.current.plans).toHaveLength(1))
  await act(async () => { await expect(result.current.respond!(loaded, true, '')).rejects.toThrow('Respuesta cerrada') })
  expect(result.current.plans[0].attending_count).toBe(5)
})

test('sustituye el total local por el total global confirmado por el servidor', async () => {
  const loader = vi.fn().mockResolvedValueOnce([{ ...plan, attending_count: 5 }])
    .mockResolvedValue([{ ...plan, attending_count: 10, own_attending: true }])
  const save = vi.fn().mockResolvedValue(undefined)
  const { result } = renderHook(() => useCalendarTrainings('2026-10-01', loader, save))
  await waitFor(() => expect(result.current.plans).toHaveLength(1))
  await act(async () => { await result.current.respond!(result.current.plans[0], true, '') })
  expect(result.current.plans[0].attending_count).toBe(10)
})
