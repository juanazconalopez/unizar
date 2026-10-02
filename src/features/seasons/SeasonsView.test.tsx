import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { todayIso } from '../../lib/dates'
import { makeMembership, makePlayerAbsence, makeProfile, makeProfilePrivateDetails, makeSeason, makeSeasonTeam } from '../../test/fixtures'
import { SeasonsView } from './SeasonsView'

const fileMocks = vi.hoisted(() => ({ downloadText: vi.fn() }))
vi.mock('../../lib/fileExport', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/fileExport')>(),
  downloadText: fileMocks.downloadText,
}))

afterEach(() => { vi.useRealTimers() })

describe('SeasonsView', () => {
  test('replaces manual memberships with team management', async () => {
    const user = userEvent.setup()
    const season = makeSeason()
    const active = makeProfile()
    const defaultTeam = { id: 'team-1', season_id: season.id, name: 'Unizar Femenino', is_default: true, is_mixed: false, is_active: true, created_by: 'owner-1', created_at: '2026-01-01', updated_at: '2026-01-01' }
    render(
      <SeasonsView
        seasons={[season]}
        profiles={[active]}
        memberships={[makeMembership()]}
        teams={[defaultTeam]}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onCreateTeam={vi.fn()}
        onUpdateTeam={vi.fn()}
        onDeleteTeam={vi.fn()}
        onAssignPlayerTeam={vi.fn()}
        onAssignTeamCoach={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Exportar jugadoras activas XML' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Gestionar equipos' }))
    expect(screen.getByRole('heading', { name: 'Equipos' })).toBeInTheDocument()
    expect(screen.getAllByText('Unizar Femenino')).not.toHaveLength(0)
  })

  test('counts current sporting absences per roster, independently of search and excluding inactive or unlinked players', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-24T12:00:00+02:00'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const season = makeSeason()
    const team = makeSeasonTeam({ id: 'team-1', name: 'Unizar A' })
    const profiles = [
      makeProfile({ id: 'current', display_name: 'Ana Vigente' }),
      makeProfile({ id: 'expired', display_name: 'Beatriz Recuperada' }),
      makeProfile({ id: 'future', display_name: 'Clara Programada' }),
      makeProfile({ id: 'discharged', display_name: 'Diana Alta' }),
      makeProfile({ id: 'unassigned', display_name: 'Eva Entrenamientos' }),
      makeProfile({ id: 'future-member', display_name: 'Fátima Incorporación' }),
      makeProfile({ id: 'inactive', display_name: 'Inactiva', is_active: false }),
      makeProfile({ id: 'unlinked', display_name: 'Sin vinculación' }),
      makeProfile({ id: 'staff', display_name: 'Entrenador', is_player: false, is_coach: true }),
    ]
    const memberships = profiles.filter((profile) => profile.id !== 'unlinked').map((profile) => makeMembership({
      id: profile.id, player_id: profile.id, season_team_id: profile.id === 'unassigned' ? null : team.id,
      license_type: profile.id === 'unassigned' ? 'training' : 'regional',
      active_from: profile.id === 'future-member' ? '2026-10-01' : '2026-01-01',
    }))
    const playerAbsences = profiles.map((profile) => makePlayerAbsence({
      id: profile.id, player_id: profile.id, starts_on: profile.id === 'future' ? '2026-10-01' : '2026-09-01',
      ends_on: profile.id === 'expired' ? '2026-09-23' : null,
      discharged_on: profile.id === 'discharged' ? '2026-09-24' : null,
    }))
    playerAbsences.push(makePlayerAbsence({ id: 'duplicate', player_id: 'current', starts_on: '2026-09-10' }))
    render(<SeasonsView seasons={[season]} profiles={profiles} memberships={memberships} teams={[team]} playerAbsences={playerAbsences}
      onCreate={vi.fn()} onDelete={vi.fn()} onUpdate={vi.fn()} onCreateTeam={vi.fn()} onUpdateTeam={vi.fn()}
      onDeleteTeam={vi.fn()} onAssignPlayerTeam={vi.fn()} onAssignTeamCoach={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Gestionar equipos' }))
    const roster = screen.getByRole('region', { name: 'Unizar A, 5 jugadoras' })
    expect(within(roster).getByLabelText('1 jugadora de baja deportiva hoy')).toHaveTextContent('1')
    expect(within(roster).getAllByRole('img', { name: 'Baja deportiva' })).toHaveLength(1)
    expect(within(roster).getByText('Ana Vigente').closest('li')).toContainElement(within(roster).getByRole('img', { name: 'Baja deportiva' }))
    const unassigned = screen.getByRole('region', { name: 'Sin equipo, 1 jugadoras' })
    expect(within(unassigned).getByLabelText('1 jugadora de baja deportiva hoy')).toBeInTheDocument()
    expect(within(unassigned).getByRole('img', { name: 'Baja deportiva' })).toBeInTheDocument()
    expect(screen.queryByText('Inactiva', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText('Sin vinculación')).not.toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Buscar jugadora' }), 'Beatriz')
    expect(within(roster).queryByRole('img', { name: 'Baja deportiva' })).not.toBeInTheDocument()
    expect(within(roster).getByLabelText('1 jugadora de baja deportiva hoy')).toHaveTextContent('1')
  })

  test.each([
    ['pasada', '2025-01-01', '2025-12-31'],
    ['futura', '2027-01-01', '2027-12-31'],
  ])('does not attach current injuries to a %s season roster', async (_state, start_date, end_date) => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-24T12:00:00+02:00'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const team = makeSeasonTeam({ id: 'team-1' })
    render(<SeasonsView seasons={[makeSeason({ start_date, end_date })]} profiles={[makeProfile()]}
      memberships={[makeMembership({ active_from: start_date, season_team_id: team.id })]} teams={[team]} playerAbsences={[makePlayerAbsence()]}
      onCreate={vi.fn()} onDelete={vi.fn()} onUpdate={vi.fn()} onCreateTeam={vi.fn()} onUpdateTeam={vi.fn()}
      onDeleteTeam={vi.fn()} onAssignPlayerTeam={vi.fn()} onAssignTeamCoach={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Gestionar equipos' }))
    const roster = screen.getByRole('region', { name: 'Unizar Femenino, 1 jugadora' })
    expect(within(roster).getByLabelText('0 jugadoras de baja deportiva hoy')).toBeInTheDocument()
    expect(within(roster).queryByRole('img', { name: 'Baja deportiva' })).not.toBeInTheDocument()
  })

  test('offers active owners alongside coaches for team assignment', async () => {
    const user = userEvent.setup()
    const season = makeSeason()
    const team = makeSeasonTeam()
    const owner = makeProfile({ id: 'owner-1', display_name: 'Lucía Martín', is_player: false, is_owner: true })
    const coach = makeProfile({ id: 'coach-1', display_name: 'Andrea López', is_player: false, is_coach: true })
    const viewer = makeProfile({ id: 'viewer-1', display_name: 'Carlos Dirección', is_player: false, is_viewer: true })
    const onAssignTeamCoach = vi.fn().mockResolvedValue(undefined)
    render(<SeasonsView seasons={[season]} profiles={[owner, coach, viewer]} memberships={[]} teams={[team]}
      onCreate={vi.fn()} onDelete={vi.fn()} onUpdate={vi.fn()} onCreateTeam={vi.fn()} onUpdateTeam={vi.fn()}
      onDeleteTeam={vi.fn()} onAssignPlayerTeam={vi.fn()} onAssignTeamCoach={onAssignTeamCoach} />)

    await user.click(screen.getByRole('button', { name: 'Gestionar equipos' }))
    await user.click(screen.getByRole('button', { name: `Editar entrenadores de ${team.name}` }))
    expect(screen.getByRole('checkbox', { name: 'Andrea López' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Lucía Martín' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Carlos Dirección' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Lucía Martín' }))
    expect(onAssignTeamCoach).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(onAssignTeamCoach).toHaveBeenCalledWith(team, [{ coachId: owner.id, assigned: true, role: 'head_coach' }]))
  })

  test('defaults to assistant coach when a head coach already exists and prevents a second head coach', async () => {
    const user = userEvent.setup()
    const season = makeSeason()
    const team = makeSeasonTeam()
    const headCoach = makeProfile({ id: 'head-coach', display_name: 'Marta Head', is_player: false, is_coach: true })
    const assistant = makeProfile({ id: 'assistant', display_name: 'Andrea Assistant', is_player: false, is_coach: true })
    const onAssignTeamCoach = vi.fn().mockResolvedValue(undefined)
    render(<SeasonsView seasons={[season]} profiles={[headCoach, assistant]} memberships={[]} teams={[team]}
      teamCoaches={[{ season_team_id: team.id, coach_id: headCoach.id, role: 'head_coach', created_at: '2026-01-01' }]}
      onCreate={vi.fn()} onDelete={vi.fn()} onUpdate={vi.fn()} onCreateTeam={vi.fn()} onUpdateTeam={vi.fn()}
      onDeleteTeam={vi.fn()} onAssignPlayerTeam={vi.fn()} onAssignTeamCoach={onAssignTeamCoach} />)

    await user.click(screen.getByRole('button', { name: 'Gestionar equipos' }))
    await user.click(screen.getByRole('button', { name: `Editar entrenadores de ${team.name}` }))
    const assistantRole = screen.getByRole('combobox', { name: 'Rol de Andrea Assistant' })
    expect(assistantRole).toHaveValue('assistant_coach')
    expect(within(assistantRole).getByRole('option', { name: 'Entrenador principal' })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: 'Andrea Assistant' }))
    expect(onAssignTeamCoach).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(onAssignTeamCoach).toHaveBeenCalledWith(team, [{ coachId: assistant.id, assigned: true, role: 'assistant_coach' }]))
  })

  test('displays team coaches one per line in role priority order', async () => {
    const user = userEvent.setup()
    const season = makeSeason()
    const team = makeSeasonTeam()
    const assistant = makeProfile({ id: 'assistant', display_name: 'Andrea Assistant', is_player: false, is_coach: true })
    const head = makeProfile({ id: 'head', display_name: 'Lucía Head', is_player: false, is_coach: true })
    render(<SeasonsView seasons={[season]} profiles={[assistant, head]} memberships={[]} teams={[team]}
      teamCoaches={[
        { season_team_id: team.id, coach_id: assistant.id, role: 'assistant_coach', created_at: '2026-01-01' },
        { season_team_id: team.id, coach_id: head.id, role: 'head_coach', created_at: '2026-01-01' },
      ]}
      onCreate={vi.fn()} onDelete={vi.fn()} onUpdate={vi.fn()} onCreateTeam={vi.fn()} onUpdateTeam={vi.fn()}
      onDeleteTeam={vi.fn()} onAssignPlayerTeam={vi.fn()} onAssignTeamCoach={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Gestionar equipos' }))
    const rows = [...document.querySelector('.season-team-coach-list')!.children]
    expect(rows.map((row) => row.textContent)).toEqual(['Entrenador principal · Lucía Head', 'Entrenador asistente · Andrea Assistant'])
    expect(rows[0].querySelector('strong')?.textContent).toBe('Entrenador principal')
    expect(rows[1].querySelector('strong')).toBeNull()
  })

  test('discards unsaved coach changes when cancelling', async () => {
    const user = userEvent.setup()
    const season = makeSeason()
    const team = makeSeasonTeam()
    const coach = makeProfile({ id: 'coach', display_name: 'Andrea López', is_player: false, is_coach: true })
    const onAssignTeamCoach = vi.fn().mockResolvedValue(undefined)
    render(<SeasonsView seasons={[season]} profiles={[coach]} memberships={[]} teams={[team]}
      onCreate={vi.fn()} onDelete={vi.fn()} onUpdate={vi.fn()} onCreateTeam={vi.fn()} onUpdateTeam={vi.fn()}
      onDeleteTeam={vi.fn()} onAssignPlayerTeam={vi.fn()} onAssignTeamCoach={onAssignTeamCoach} />)

    await user.click(screen.getByRole('button', { name: 'Gestionar equipos' }))
    await user.click(screen.getByRole('button', { name: `Editar entrenadores de ${team.name}` }))
    await user.click(screen.getByRole('checkbox', { name: coach.display_name }))
    expect(onAssignTeamCoach).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onAssignTeamCoach).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: `Editar entrenadores de ${team.name}` }))
    expect(screen.getByRole('checkbox', { name: coach.display_name })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })

  test('only offers team assignment to players linked to the selected season', async () => {
    const user = userEvent.setup()
    const season = makeSeason()
    const member = makeProfile({ id: 'member', display_name: 'Ana Martín' })
    const unlinked = makeProfile({ id: 'unlinked', display_name: 'Beatriz López' })
    const team = { id: 'team-1', season_id: season.id, name: 'Unizar A', is_default: true, is_mixed: false, is_active: true, created_by: 'owner-1', created_at: '2026-01-01', updated_at: '2026-01-01' }
    render(<SeasonsView seasons={[season]} profiles={[member, unlinked]} memberships={[makeMembership({ player_id: member.id, season_team_id: team.id })]} teams={[team]} onCreate={vi.fn()} onDelete={vi.fn()} onUpdate={vi.fn()} onCreateTeam={vi.fn()} onUpdateTeam={vi.fn()} onDeleteTeam={vi.fn()} onAssignPlayerTeam={vi.fn()} onAssignTeamCoach={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Gestionar equipos' }))
    const roster = screen.getByRole('region', { name: 'Unizar A, 1 jugadora' })
    expect(within(roster).getByText('Ana Martín')).toBeInTheDocument()
    expect(screen.queryByText('Beatriz López')).not.toBeInTheDocument()
    expect(within(roster).getByRole('button', { name: 'Mover a Ana Martín a otro equipo' })).toBeDisabled()
  })

  test('groups players by team, filters by name and offers active destinations', async () => {
    const user = userEvent.setup()
    const season = makeSeason()
    const firstTeam = makeSeasonTeam({ id: 'team-1', name: 'Unizar A' })
    const secondTeam = makeSeasonTeam({ id: 'team-2', name: 'Unizar B', is_default: false })
    const inactiveTeam = makeSeasonTeam({ id: 'team-3', name: 'Equipo antiguo', is_default: false, is_active: false })
    const ana = makeProfile({ id: 'ana', display_name: 'Ana Martín' })
    const bea = makeProfile({ id: 'bea', display_name: 'Beatriz López' })
    const onAssignPlayerTeam = vi.fn().mockResolvedValue(undefined)
    render(<SeasonsView seasons={[season]} profiles={[ana, bea]} memberships={[
      makeMembership({ player_id: ana.id, season_team_id: firstTeam.id }),
      makeMembership({ id: 'membership-2', player_id: bea.id, season_team_id: secondTeam.id }),
    ]} teams={[firstTeam, secondTeam, inactiveTeam]} onCreate={vi.fn()} onDelete={vi.fn()} onUpdate={vi.fn()} onCreateTeam={vi.fn()} onUpdateTeam={vi.fn()} onDeleteTeam={vi.fn()} onAssignPlayerTeam={onAssignPlayerTeam} onAssignTeamCoach={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Gestionar equipos' }))
    expect(within(screen.getByRole('region', { name: 'Unizar A, 1 jugadora' })).getByText('Ana Martín')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Unizar B, 1 jugadora' })).getByText('Beatriz López')).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Buscar jugadora' }), 'beatriz')
    expect(screen.queryByRole('region', { name: 'Unizar A, 1 jugadora' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Unizar B, 1 jugadora' })).toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox', { name: 'Buscar jugadora' }))
    await user.click(screen.getByRole('button', { name: 'Mover a Ana Martín a otro equipo' }))
    expect(screen.getByText('Equipo actual: Unizar A')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Equipo antiguo/ })).not.toBeInTheDocument()
    await user.click(within(screen.getByRole('group', { name: 'Equipo de destino' })).getByRole('button', { name: /Unizar B/ }))
    await waitFor(() => expect(onAssignPlayerTeam).toHaveBeenCalledWith(season, ana, secondTeam.id))
  })

  test('keeps the player in the original team when a move fails', async () => {
    const user = userEvent.setup()
    const season = makeSeason()
    const firstTeam = makeSeasonTeam({ id: 'team-1', name: 'Unizar A' })
    const secondTeam = makeSeasonTeam({ id: 'team-2', name: 'Unizar B', is_default: false })
    const player = makeProfile()
    const onAssignPlayerTeam = vi.fn().mockRejectedValue(new Error('No se ha podido guardar el cambio.'))
    render(<SeasonsView seasons={[season]} profiles={[player]} memberships={[makeMembership({ season_team_id: firstTeam.id })]}
      teams={[firstTeam, secondTeam]} onCreate={vi.fn()} onDelete={vi.fn()} onUpdate={vi.fn()} onCreateTeam={vi.fn()}
      onUpdateTeam={vi.fn()} onDeleteTeam={vi.fn()} onAssignPlayerTeam={onAssignPlayerTeam} onAssignTeamCoach={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Gestionar equipos' }))
    await user.click(screen.getByRole('button', { name: 'Mover a Ana Martín a otro equipo' }))
    await user.click(within(screen.getByRole('group', { name: 'Equipo de destino' })).getByRole('button', { name: /Unizar B/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido guardar el cambio.')
    expect(screen.getByText('Equipo actual: Unizar A')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Volver a equipos' }))
    expect(within(screen.getByRole('region', { name: 'Unizar A, 1 jugadora' })).getByText('Ana Martín')).toBeInTheDocument()
  })

  test('shows the player export only inside the active season card', () => {
    render(<SeasonsView
      seasons={[
        makeSeason(),
        makeSeason({ id: 'past-season', name: 'Temporada pasada', start_date: '2025-01-01', end_date: '2025-12-31' }),
      ]}
      profiles={[makeProfile()]}
      memberships={[makeMembership()]}
      onCreate={vi.fn()}
      onDelete={vi.fn()}
      onUpdate={vi.fn()}
      onToggleMembership={vi.fn()}
    />)

    expect(within(screen.getByText('Temporada 2026').closest('article')!).getByRole('button', { name: 'Exportar jugadoras activas XML' })).toBeInTheDocument()
    expect(within(screen.getByText('Temporada pasada').closest('article')!).queryByRole('button', { name: /Exportar jugadoras/ })).not.toBeInTheDocument()
  })

  test('exports contact details, age and birth date for active season players', async () => {
    const user = userEvent.setup()
    const birthDate = `${Number(todayIso().slice(0, 4)) - 20}-01-01`
    render(<SeasonsView
      seasons={[makeSeason()]}
      profiles={[makeProfile()]}
      profilePrivateDetails={[makeProfilePrivateDetails({ birth_date: birthDate })]}
      memberships={[makeMembership()]}
      onCreate={vi.fn()}
      onDelete={vi.fn()}
      onUpdate={vi.fn()}
      onToggleMembership={vi.fn()}
    />)

    await user.click(screen.getByRole('button', { name: 'Exportar jugadoras activas XML' }))
    expect(fileMocks.downloadText).toHaveBeenCalledWith(
      'jugadoras-activas-Temporada 2026.xml',
      expect.stringContaining(`email="ana@example.com" telefono="600 00 00 00" edad="20" fecha-nacimiento="${birthDate}"`),
      'application/xml',
    )
  })

  test('creates a season from the form', async () => {
    const user = userEvent.setup()
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<SeasonsView seasons={[]} profiles={[]} memberships={[]} onCreate={onCreate} onDelete={vi.fn()} onUpdate={vi.fn()} onToggleMembership={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Nueva temporada' }))
    await user.type(screen.getByLabelText('Nombre'), 'Temporada 2027')
    await user.type(screen.getByLabelText('Fecha de inicio'), '2027-01-01')
    await user.type(screen.getByLabelText('Fecha de finalización'), '2027-12-31')
    await user.click(screen.getByRole('button', { name: 'Crear temporada' }))

    expect(onCreate).toHaveBeenCalledWith({ name: 'Temporada 2027', start_date: '2027-01-01', end_date: '2027-12-31' })
  })

  test('edits a season and warns about cascading data before deleting it', async () => {
    const user = userEvent.setup()
    const season = makeSeason()
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<SeasonsView seasons={[season]} profiles={[]} memberships={[makeMembership()]} onCreate={vi.fn()} onDelete={onDelete} onUpdate={onUpdate} onToggleMembership={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    expect(screen.getByRole('heading', { name: 'Editar temporada' })).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Nombre'))
    await user.type(screen.getByLabelText('Nombre'), 'Temporada corregida')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(onUpdate).toHaveBeenCalledWith(season, expect.objectContaining({ name: 'Temporada corregida' }))

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    await user.click(screen.getByRole('button', { name: 'Eliminar temporada' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('entrenamientos de campo y asistencias'))
    expect(onDelete).toHaveBeenCalledWith(season)
  })
})
