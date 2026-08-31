import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useOperationFeedback } from './useOperationFeedback'

describe('useOperationFeedback', () => {
  afterEach(() => vi.useRealTimers())

  test('keeps the newest message visible for its complete duration', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useOperationFeedback())
    act(() => result.current.notify('Primero'))
    act(() => vi.advanceTimersByTime(3000))
    act(() => result.current.notify('Segundo'))
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.message).toBe('Segundo')
    act(() => vi.advanceTimersByTime(2500))
    expect(result.current.message).toBe('')
  })

  test('normalizes operation errors for the shared banner', () => {
    const { result } = renderHook(() => useOperationFeedback())
    act(() => { result.current.reportError(new Error('No se pudo guardar')) })
    expect(result.current.operationError).toBe('No se pudo guardar')
  })
})
