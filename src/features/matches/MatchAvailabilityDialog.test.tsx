import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { addDays, todayIso } from '../../lib/dates'
import { makeProfile } from '../../test/fixtures'
import type { Match } from '../../types'
import { MatchAvailabilityDialog } from './MatchAvailabilityDialog'

const match: Match = {
  id: 'match-1', season_id: 'season-1', opponent: 'Rival', match_date: addDays(todayIso(), 4), kickoff_time: null,
  venue: null, callup_time: null, callup_venue: null, is_home: true, notes: null, status: 'published', match_kind: 'official', rugby_format: 'xv',
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
  test('añade una jugadora de solo entrenamientos sin cambiar su ficha y conserva errores del servidor', async () => {
    const user = userEvent.setup()
    const player = makeProfile({ display_name: 'Leyre Pérez Gimeno' })
    const onAdd = vi.fn().mockRejectedValueOnce(new Error('La jugadora está de baja en esta fecha')).mockResolvedValue(undefined)
    render(<MatchAvailabilityDialog availability={[]} eligibleProfiles={[]} match={{ ...match, match_date: '2999-01-01' }} profiles={[player]} trainingProfiles={[player]} onAddTrainingPlayer={onAdd} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Añadir de solo entrenamientos' }))
    const editor = screen.getByRole('dialog', { name: 'Añadir de solo entrenamientos' })
    await user.selectOptions(within(editor).getByLabelText('Jugadora'), player.id)
    await user.type(within(editor).getByLabelText('Motivo opcional'), 'Autorizada para este encuentro')
    await user.click(within(editor).getByRole('button', { name: 'Añadir al partido' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('La jugadora está de baja')
    expect(within(editor).getByLabelText('Jugadora')).toHaveValue(player.id)
    await user.click(within(editor).getByRole('button', { name: 'Añadir al partido' }))
    expect(onAdd).toHaveBeenLastCalledWith(player.id, 'Autorizada para este encuentro', undefined)
  })
  test('incorpora el dorsal 17 a un acta pasada tras confirmar la participación', async () => {
    const user = userEvent.setup()
    const player = makeProfile({ display_name: 'Leyre Pérez Gimeno' })
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<MatchAvailabilityDialog availability={[]} canEdit eligibleProfiles={[]} match={{ ...match, match_date: '2000-01-01', status: 'completed', lineup_published: true }} profiles={[player]} trainingProfiles={[player]} onAddTrainingPlayer={onAdd} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Añadir de solo entrenamientos' }))
    const editor = screen.getByRole('dialog', { name: 'Añadir de solo entrenamientos' })
    await user.selectOptions(within(editor).getByLabelText('Jugadora'), player.id)
    await user.selectOptions(within(editor).getByLabelText('Dorsal del acta'), '17')
    expect(within(editor).getByRole('button', { name: 'Añadir al partido' })).toBeDisabled()
    await user.click(within(editor).getByLabelText(/Confirmo que esta jugadora participó/))
    await user.click(within(editor).getByRole('button', { name: 'Añadir al partido' }))
    expect(onAdd).toHaveBeenCalledWith(player.id, '', 17)
  })
  test('permite elegir la ficha B del derbi para la autorización', async () => {
    const user = userEvent.setup()
    const away = { ...match, id: 'away', is_home: false }
    const select = vi.fn()
    render(<MatchAvailabilityDialog availability={[]} eligibleProfiles={[]} match={match} pairedMatch={away} profiles={[]} onSelectMatch={select} onClose={vi.fn()} />)
    await user.click(screen.getByRole('tab', { name: 'Equipo visitante' }))
    expect(select).toHaveBeenCalledWith(away)
  })

})
