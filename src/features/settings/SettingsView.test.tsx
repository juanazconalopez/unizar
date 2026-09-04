import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { makeMembership, makeProfile, makeSeason } from '../../test/fixtures'
import { SettingsView } from './SettingsView'

describe('SettingsView', () => {
  test('opens team administration by default without duplicate tabs', () => {
    render(<SettingsView currentUserId="owner-1" memberships={[makeMembership()]} profiles={[makeProfile()]} seasons={[makeSeason()]} onCreateSeason={vi.fn()} onDeleteSeason={vi.fn()} onToggleMembership={vi.fn()} onUpdateProfile={vi.fn()} onUpdateSeason={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Ajustes - Equipo' })).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  test('opens season management first when there is no active season', () => {
    render(<SettingsView currentUserId="owner-1" memberships={[]} profiles={[]} seasons={[makeSeason({ start_date: '2025-01-01', end_date: '2025-12-31' })]} onCreateSeason={vi.fn()} onDeleteSeason={vi.fn()} onToggleMembership={vi.fn()} onUpdateProfile={vi.fn()} onUpdateSeason={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Ajustes - Temporadas' })).toBeInTheDocument()
  })

  test('opens the library settings section from navigation', () => {
    render(<SettingsView section="library" currentUserId="owner-1" memberships={[]} profiles={[]} seasons={[makeSeason()]} onCreateSeason={vi.fn()} onDeleteSeason={vi.fn()} onToggleMembership={vi.fn()} onUpdateProfile={vi.fn()} onUpdateSeason={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Ajustes - Librería' })).toBeInTheDocument()
  })

  test('renders each settings section selected by the navigation submenu', () => {
    const view = render(<SettingsView section="seasons" currentUserId="owner-1" memberships={[makeMembership()]} profiles={[makeProfile()]} seasons={[makeSeason()]} onCreateSeason={vi.fn()} onDeleteSeason={vi.fn()} onToggleMembership={vi.fn()} onUpdateProfile={vi.fn()} onUpdateSeason={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Ajustes - Temporadas' })).toBeInTheDocument()
    view.rerender(<SettingsView section="library" currentUserId="owner-1" memberships={[makeMembership()]} profiles={[makeProfile()]} seasons={[makeSeason()]} onCreateSeason={vi.fn()} onDeleteSeason={vi.fn()} onToggleMembership={vi.fn()} onUpdateProfile={vi.fn()} onUpdateSeason={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Ajustes - Librería' })).toBeInTheDocument()
    view.rerender(<SettingsView section="team" currentUserId="owner-1" memberships={[makeMembership()]} profiles={[makeProfile()]} seasons={[makeSeason()]} onCreateSeason={vi.fn()} onDeleteSeason={vi.fn()} onToggleMembership={vi.fn()} onUpdateProfile={vi.fn()} onUpdateSeason={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Personas del equipo' })).toBeInTheDocument()
  })
})
