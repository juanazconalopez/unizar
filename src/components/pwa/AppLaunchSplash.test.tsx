import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppLaunchSplash } from './AppLaunchSplash'

describe('AppLaunchSplash', () => {
  afterEach(() => vi.useRealTimers())

  it('muestra primero la foto y después la marca antes de desaparecer', () => {
    vi.useFakeTimers()
    const { container } = render(<AppLaunchSplash />)
    const splash = screen.getByRole('status')
    const photo = container.querySelector<HTMLImageElement>('.launch-splash-photo')

    expect(splash).toHaveClass('photo')
    expect(photo).not.toBeNull()
    fireEvent.load(photo!)

    act(() => vi.advanceTimersByTime(999))
    expect(splash).toHaveClass('photo')

    act(() => vi.advanceTimersByTime(1))
    expect(splash).toHaveClass('brand')

    act(() => vi.advanceTimersByTime(750))
    expect(splash).toHaveClass('leaving')

    act(() => vi.advanceTimersByTime(250))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
