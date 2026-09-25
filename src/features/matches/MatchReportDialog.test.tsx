import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { makeProfile } from '../../test/fixtures'
import type { Match, MatchLineup } from '../../types'
import { MatchReportDialog } from './MatchReportDialog'
import { readMatchReportPdf } from '../../services/matchReportService'

vi.mock('../../services/matchReportService', () => ({ readMatchReportPdf: vi.fn() }))

const match = { id: 'match-1', match_date: '2025-10-18', opponent: 'Ingenieros de Soria', is_home: true, match_kind: 'official', rugby_format: 'xv', duration_minutes: 80 } as Match
const lineup = [
  { match_id: 'match-1', player_id: 'player-1', role: 'starter', slot_number: 1, sort_order: 1 },
  { match_id: 'match-1', player_id: 'player-2', role: 'substitute', slot_number: 16, sort_order: 16 },
] as MatchLineup[]

describe('MatchReportDialog', () => {
  test('prefills score and substitution, then saves reviewed player events', async () => {
    vi.mocked(readMatchReportPdf).mockResolvedValue({ date: '2025-10-18', homeTeam: 'Unizar femenino', awayTeam: 'Ingenieros de Soria', homeScore: 46, awayScore: 7, recognized: true, events: { home: [{ type: 'substitution', dorsal: 1, replacementDorsal: 16, minute: 40 }], away: [] } })
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<MatchReportDialog match={match} lineup={lineup} profiles={[makeProfile(), makeProfile({ id: 'player-2', display_name: 'Inés' })]} onClose={vi.fn()} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Acta en PDF'), { target: { files: [new File(['pdf'], 'acta.pdf', { type: 'application/pdf' })] } })
    await waitFor(() => expect(screen.getByLabelText('Puntos del equipo')).toHaveValue(46))
    expect(screen.getByLabelText('Puntos del rival')).toHaveValue(7)
    expect(screen.getByLabelText('Jugadora, Dorsal 1 → 16')).toHaveValue('player-1')
    expect(screen.getByLabelText('Jugadora que entra, Dorsal 1 → 16')).toHaveValue('player-2')
    fireEvent.click(screen.getByLabelText(/He revisado todos los cambios/))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar acta' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.any(File), { team: 46, opponent: 7 }, 80, [{ event_type: 'substitution', event_minute: 40, player_id: 'player-1', replacement_player_id: 'player-2' }], true))
  })
})
