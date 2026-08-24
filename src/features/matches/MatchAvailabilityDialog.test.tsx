import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { addDays, todayIso } from '../../lib/dates'
import { makeProfile } from '../../test/fixtures'
import type { Match } from '../../types'
import { MatchAvailabilityDialog } from './MatchAvailabilityDialog'

const match: Match = {
  id: 'match-1', season_id: 'season-1', opponent: 'Rival', match_date: addDays(todayIso(), 4), kickoff_time: null,
  venue: null, is_home: true, notes: null, status: 'published', match_kind: 'official', rugby_format: 'xv',
  lineup_published: false, created_by: 'coach-1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  seasons: { name: 'Temporada' },
}

describe('MatchAvailabilityDialog', () => {
  test('lets a coach register a communicated player response', async () => {
    const user = userEvent.setup()
    const player = makeProfile({ display_name: 'Ana Martín' })
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<MatchAvailabilityDialog
      availability={[]}
      canEdit
      eligibleProfiles={[player]}
      match={match}
      profiles={[player]}
      onClose={vi.fn()}
      onSave={onSave}
    />)

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const editor = screen.getByRole('dialog', { name: 'Ana Martín' })
    await user.selectOptions(within(editor).getByLabelText('Respuesta'), 'unavailable')
    await user.type(within(editor).getByLabelText('Comentario opcional'), 'Baja comunicada por teléfono')
    await user.click(within(editor).getByRole('button', { name: 'Guardar disponibilidad' }))

    expect(onSave).toHaveBeenCalledWith('player-1', 'unavailable', 'Baja comunicada por teléfono')
  })

  test('keeps the team response list read-only without coach editing permission', () => {
    const player = makeProfile()
    render(<MatchAvailabilityDialog availability={[]} eligibleProfiles={[player]} match={match} profiles={[player]} onClose={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })

  test('tells a coach to unlock a published lineup before changing responses', () => {
    const player = makeProfile()
    render(<MatchAvailabilityDialog availability={[]} canEdit eligibleProfiles={[player]} match={{ ...match, lineup_published: true }} profiles={[player]} onClose={vi.fn()} onSave={vi.fn()} />)
    expect(screen.getByText('Edición de disponibilidad cerrada')).toBeInTheDocument()
    expect(screen.getByText(/Desbloquea primero la convocatoria/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
  })
})
