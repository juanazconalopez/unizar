import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppLaunchSplash } from './AppLaunchSplash'
import { StrictMode } from 'react'

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

  it('desaparece aunque la fotografía siga pendiente, también en StrictMode', () => {
    vi.useFakeTimers()
    render(<StrictMode><AppLaunchSplash /></StrictMode>)
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('desaparece si falla la fotografía y limpia los temporizadores al desmontarse', () => {
    vi.useFakeTimers()
    const { container, unmount } = render(<AppLaunchSplash />)
    fireEvent.error(container.querySelector('.launch-splash-photo')!)
    act(() => vi.advanceTimersByTime(2000))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
