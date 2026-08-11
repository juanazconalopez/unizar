import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { makeMembership, makeProfile, makeSeason } from '../../test/fixtures'
import { SettingsView } from './SettingsView'

describe('SettingsView', () => {
  test('groups team and season administration in tabs', async () => {
    const user = userEvent.setup()
    render(<SettingsView currentUserId="owner-1" memberships={[makeMembership()]} profiles={[makeProfile()]} seasons={[makeSeason()]} onCreateSeason={vi.fn()} onDeleteSeason={vi.fn()} onToggleMembership={vi.fn()} onUpdateProfile={vi.fn()} onUpdateSeason={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Equipo' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Temporadas' }))
    expect(screen.getByRole('heading', { name: 'Temporadas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nueva temporada' })).toBeInTheDocument()
  })

  test('opens season management first when there is no active season', () => {
    render(<SettingsView currentUserId="owner-1" memberships={[]} profiles={[]} seasons={[makeSeason({ start_date: '2025-01-01', end_date: '2025-12-31' })]} onCreateSeason={vi.fn()} onDeleteSeason={vi.fn()} onToggleMembership={vi.fn()} onUpdateProfile={vi.fn()} onUpdateSeason={vi.fn()} />)
    expect(screen.getByRole('tab', { name: 'Temporadas' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Temporadas' })).toBeInTheDocument()
  })
})
