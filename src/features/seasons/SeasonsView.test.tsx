import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { todayIso } from '../../lib/dates'
import { makeMembership, makeProfile, makeProfilePrivateDetails, makeSeason, makeSeasonTeam } from '../../test/fixtures'
import { SeasonsView } from './SeasonsView'

const fileMocks = vi.hoisted(() => ({ downloadText: vi.fn() }))
vi.mock('../../lib/fileExport', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/fileExport')>(),
  downloadText: fileMocks.downloadText,
}))

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
