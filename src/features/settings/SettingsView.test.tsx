import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { makeMembership, makeProfile, makeSeason } from '../../test/fixtures'
import { SettingsView } from './SettingsView'

describe('SettingsView', () => {
  test('groups team and season administration in tabs', async () => {
    const user = userEvent.setup()
    render(<SettingsView currentUserId="owner-1" memberships={[makeMembership()]} profiles={[makeProfile()]} seasons={[makeSeason()]} onCreateSeason={vi.fn()} onToggleMembership={vi.fn()} onUpdateProfile={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Equipo' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Temporadas' }))
    expect(screen.getByRole('heading', { name: 'Temporadas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nueva temporada' })).toBeInTheDocument()
  })
})
