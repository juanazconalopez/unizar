import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { addDays, formatDate, todayIso } from '../../lib/dates'
import { makeAttendance, makeMembership, makeProfile, makeProvisionalAttendance, makeProvisionalPlayer, makeSeason, makeSession } from '../../test/fixtures'
import { AttendanceView } from './AttendanceView'

describe('AttendanceView', () => {
  test('shows only active players, restores attendance and saves changes', async () => {
    const user = userEvent.setup()
    const today = todayIso()
    const profiles = [
      makeProfile(),
      makeProfile({ id: 'player-2', display_name: 'María López' }),
      makeProfile({ id: 'inactive', display_name: 'Inactiva', is_active: false }),
      makeProfile({ id: 'pending', display_name: 'Pendiente', is_approved: false }),
      makeProfile({ id: 'archived', display_name: 'Archivada', is_archived: true }),
      makeProfile({ id: 'owner', display_name: 'Owner Excluida', is_owner: true }),
    ]
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <AttendanceView
        profiles={profiles}
        memberships={[
          makeMembership(),
          makeMembership({ id: 'membership-2', player_id: 'player-2' }),
        ]}
        sessions={[makeSession({ session_date: today })]}
        attendance={[makeAttendance({ training_sessions: { session_date: today } })]}
        seasons={[makeSeason({ start_date: '2026-01-01', end_date: '2026-12-31' })]}
        onSave={onSave}
      />,
    )

    const list = screen.getByText('JUGADORAS ACTIVAS').closest('section')!
    expect(within(list).getByText('Ana Martín')).toBeInTheDocument()
    expect(within(list).getByText('María López')).toBeInTheDocument()
    expect(screen.queryByText('Inactiva')).not.toBeInTheDocument()
    expect(screen.queryByText('Owner Excluida')).not.toBeInTheDocument()
    expect(within(list).getByRole('checkbox', { name: /Ana Martín/ })).toBeChecked()
    expect(screen.getByText(/Temporada:/)).toHaveTextContent('Temporada 2026')

    await user.click(within(list).getByRole('checkbox', { name: /María López/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))

    expect(onSave).toHaveBeenCalledWith(today, ['player-1', 'player-2'], ['player-1', 'player-2'], [])
    expect(screen.getByText('Asistencia guardada para esta fecha.')).toBeInTheDocument()
  })

  test('excludes memberships from another season but still allows invited attendees', () => {
    const today = todayIso()
    render(
      <AttendanceView
        profiles={[makeProfile()]}
        memberships={[makeMembership({ season_id: 'previous-season' })]}
        seasons={[makeSeason({ id: 'current-season', start_date: '2026-01-01', end_date: '2026-12-31' })]}
        sessions={[]}
        attendance={[]}
        onSave={vi.fn()}
      />,
    )

    expect(today).toMatch(/^2026-/)
    expect(screen.queryByText('Ana Martín')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir invitada' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar asistencia' })).toBeInTheDocument()
  })

  test('adds new and returning invited players and saves them as attendees', async () => {
    const user = userEvent.setup()
    const today = todayIso()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<AttendanceView
      attendance={[]}
      memberships={[makeMembership()]}
      profiles={[makeProfile()]}
      provisionalAttendance={[makeProvisionalAttendance({ training_sessions: { session_date: '2026-08-01' } })]}
      provisionalPlayers={[makeProvisionalPlayer()]}
      seasons={[makeSeason({ start_date: '2026-01-01', end_date: '2026-12-31' })]}
      sessions={[]}
      onSave={onSave}
    />)

    await user.click(screen.getByRole('checkbox', { name: /Ana Martín/ }))
    await user.click(screen.getByRole('button', { name: 'Añadir invitada' }))
    let dialog = screen.getByRole('dialog', { name: 'Añadir invitada' })
    await user.selectOptions(within(dialog).getByLabelText('Invitada anterior'), 'guest-1')
    await user.click(within(dialog).getByRole('button', { name: 'Añadir invitada' }))
    expect(screen.getByRole('region', { name: 'Invitadas: 1' })).toHaveTextContent('Laura Invitada')

    await user.click(screen.getByRole('button', { name: 'Añadir invitada' }))
    dialog = screen.getByRole('dialog', { name: 'Añadir invitada' })
    await user.type(within(dialog).getByLabelText('Nombre y apellidos'), '  Nuria   Prueba  ')
    await user.click(within(dialog).getByRole('button', { name: 'Añadir invitada' }))
    expect(screen.getByRole('region', { name: 'Invitadas: 2' })).toHaveTextContent('Nuria Prueba')
    expect(screen.getByText('1 del equipo · 2 invitadas').closest('.attendance-count')).toHaveTextContent('3')

    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))
    expect(onSave).toHaveBeenCalledWith(today, ['player-1'], ['player-1'], [
      { id: 'guest-1', displayName: 'Laura Invitada' },
      { displayName: 'Nuria Prueba' },
    ])
  })
})

describe('base de asistencia desde respuestas', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-23T22:00:00+02:00'))
  })
  afterEach(() => vi.useRealTimers())
  const common = () => ({ profiles: [makeProfile(), makeProfile({ id: 'player-2', display_name: 'María López' }), makeProfile({ id: 'player-3', display_name: 'Eva García' })], memberships: [makeMembership(), makeMembership({ id: 'm2', player_id: 'player-2' }), makeMembership({ id: 'm3', player_id: 'player-3' })], sessions: [], attendance: [], seasons: [makeSeason({ start_date: '2026-01-01', end_date: '2026-12-31' })], onSave: vi.fn().mockResolvedValue(undefined) })
  test('preselecciona las confirmadas y permite corregirlas antes de guardar asistencia real', async () => {
    const props = common()
    const user = userEvent.setup()
    const onLoadBasis = vi.fn().mockResolvedValue({ recorded: false, attended_player_ids: [], responses: [{ player_id: 'player-1', attending: true, comment: '' }, { player_id: 'player-2', attending: false, comment: 'Trabajo' }] })
    render(<AttendanceView {...props} onLoadBasis={onLoadBasis} />)
    expect(await screen.findByText(/Base de las respuestas:/)).toHaveTextContent('1 asistirán · 1 rechazan · 1 sin responder')
    expect(screen.getByRole('checkbox', { name: /Ana Martín/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /María López/ })).not.toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: /Ana Martín/ }))
    await user.click(screen.getByRole('checkbox', { name: /Eva García/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))
    expect(props.onSave).toHaveBeenCalledWith(todayIso(), ['player-1', 'player-2', 'player-3'], ['player-3'], [])
    expect(screen.getByText(/Las respuestas de las jugadoras están cerradas/)).toBeInTheDocument()
  })
  test('los viernes son de consulta hasta que exista el registro automático', async () => {
    const props = common()
    render(<AttendanceView {...props} onLoadBasis={async () => ({ self_managed: true, recorded: false, attended_player_ids: [], responses: [{ player_id: 'player-1', attending: true, comment: '' }] })} />)
    await screen.findByText(/La asistencia se registrará automáticamente/)
    expect(screen.getByRole('checkbox', { name: /Ana Martín/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Ana Martín/ })).toBeDisabled()
    expect(screen.getByRole('checkbox', { name: /María López/ })).not.toBeChecked()
    expect(screen.queryByRole('button', { name: 'Guardar asistencia' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Añadir invitada' })).not.toBeInTheDocument()
    expect(props.onSave).not.toHaveBeenCalled()
  })

  test('permite corregir varias veces el registro automático, incluidas las invitadas', async () => {
    const props = common()
    const user = userEvent.setup()
    render(<AttendanceView {...props} onLoadBasis={async () => ({ self_managed: true, recorded: true, attended_player_ids: ['player-1'], responses: [{ player_id: 'player-2', attending: true, comment: '' }] })} />)
    await screen.findByText(/Asistencia registrada automáticamente/)
    expect(screen.getByRole('checkbox', { name: /Ana Martín/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /María López/ })).not.toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: /Ana Martín/ }))
    await user.click(screen.getByRole('checkbox', { name: /Eva García/ }))
    await user.click(screen.getByRole('button', { name: 'Añadir invitada' }))
    const dialog = screen.getByRole('dialog', { name: 'Añadir invitada' })
    await user.type(within(dialog).getByLabelText('Nombre y apellidos'), 'Nuria Prueba')
    await user.click(within(dialog).getByRole('button', { name: 'Añadir invitada' }))
    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))
    expect(props.onSave).toHaveBeenLastCalledWith(todayIso(), ['player-1', 'player-2', 'player-3'], ['player-3'], [{ displayName: 'Nuria Prueba' }])
    await user.click(screen.getByRole('button', { name: 'Quitar a Nuria Prueba' }))
    await user.click(screen.getByRole('checkbox', { name: /Eva García/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))
    expect(props.onSave).toHaveBeenCalledTimes(2)
    expect(props.onSave).toHaveBeenLastCalledWith(todayIso(), ['player-1', 'player-2', 'player-3'], [], [])
    expect(screen.getByRole('button', { name: 'Guardar asistencia' })).toBeEnabled()
  })

  test.each([false, true])('restaura una asistencia real vacía aunque haya respuestas afirmativas (automática: %s)', async (selfManaged) => {
    render(<AttendanceView {...common()} onLoadBasis={async () => ({ self_managed: selfManaged, recorded: true, attended_player_ids: [], responses: [{ player_id: 'player-1', attending: true, comment: '' }] })} />)
    await screen.findByText(selfManaged ? /Asistencia registrada automáticamente/ : /Asistencia real guardada/)
    expect(screen.getByRole('checkbox', { name: /Ana Martín/ })).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Guardar asistencia' })).toBeEnabled()
  })

  test('mantiene los permisos de registro y de invitadas al corregir un viernes', async () => {
    const props = common()
    const basis = { self_managed: true, recorded: true, attended_player_ids: ['player-1'], responses: [] }
    const onLoadBasis = async () => basis
    const { rerender } = render(<AttendanceView {...props} canManageGuests={false} canRecord={false} onLoadBasis={onLoadBasis} />)
    await screen.findByText(/Asistencia registrada automáticamente/)
    expect(screen.getByRole('checkbox', { name: /Ana Martín/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Guardar asistencia' })).not.toBeInTheDocument()
    rerender(<AttendanceView {...props} canManageGuests={false} canRecord onLoadBasis={onLoadBasis} />)
    expect(screen.getByRole('checkbox', { name: /Ana Martín/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Guardar asistencia' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Añadir invitada' })).not.toBeInTheDocument()
  })

  test('no desbloquea un registro automático si falla la carga de su base', async () => {
    render(<AttendanceView {...common()} sessions={[makeSession({ session_date: todayIso(), self_managed: true })]} onLoadBasis={async () => { throw new Error('Sin conexión') }} />)
    await screen.findByText('Sin conexión')
    expect(screen.getByRole('checkbox', { name: /Ana Martín/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Guardar asistencia' })).toBeDisabled()
  })

  test('conserva las correcciones frente a recargas antiguas antes y después de guardar', async () => {
    const props = common()
    const user = userEvent.setup()
    const previousBasis = { self_managed: true, recorded: true, attended_player_ids: ['player-1'], responses: [] }
    const { rerender } = render(<AttendanceView {...props} onLoadBasis={async () => previousBasis} />)
    await screen.findByText(/Asistencia registrada automáticamente/)
    await user.click(screen.getByRole('checkbox', { name: /María López/ }))
    await user.click(screen.getByRole('button', { name: 'Añadir invitada' }))
    const dialog = screen.getByRole('dialog', { name: 'Añadir invitada' })
    await user.type(within(dialog).getByLabelText('Nombre y apellidos'), 'Nuria Prueba')
    await user.click(within(dialog).getByRole('button', { name: 'Añadir invitada' }))
    await act(async () => { rerender(<AttendanceView {...props} onLoadBasis={async () => previousBasis} />) })
    expect(screen.getByRole('checkbox', { name: /María López/ })).toBeChecked()
    expect(screen.getByRole('region', { name: 'Invitadas: 1' })).toHaveTextContent('Nuria Prueba')

    let finish!: (basis: typeof previousBasis) => void
    const pendingLoad = () => new Promise<typeof previousBasis>((resolve) => { finish = resolve })
    rerender(<AttendanceView {...props} onLoadBasis={pendingLoad} />)
    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))
    await act(async () => { finish(previousBasis) })
    expect(screen.getByRole('checkbox', { name: /María López/ })).toBeChecked()
    expect(screen.getByRole('region', { name: 'Invitadas: 1' })).toHaveTextContent('Nuria Prueba')
    await user.click(screen.getByRole('checkbox', { name: /Ana Martín/ }))
    await user.click(screen.getByRole('button', { name: 'Guardar asistencia' }))
    expect(props.onSave).toHaveBeenLastCalledWith(todayIso(), ['player-1', 'player-2', 'player-3'], ['player-2'], [{ displayName: 'Nuria Prueba' }])
  })
  test('ignora una base tardía de otra fecha', async () => {
    const user = userEvent.setup()
    const yesterday = addDays(todayIso(), -1)
    let finish!: (basis: { recorded: boolean; attended_player_ids: string[]; responses: { player_id: string; attending: boolean; comment: string }[] }) => void
    const onLoadBasis = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve })).mockResolvedValue({ recorded: true, attended_player_ids: [], responses: [] })
    render(<AttendanceView {...common()} sessions={[makeSession({ session_date: yesterday })]} onLoadBasis={onLoadBasis} />)
    await user.click(screen.getByRole('button', { name: formatDate(yesterday, { day: 'numeric', month: 'short' }) }))
    await screen.findByText(/Asistencia real guardada/)
    await act(async () => { finish({ recorded: false, attended_player_ids: [], responses: [{ player_id: 'player-1', attending: true, comment: '' }] }) })
    expect(screen.getByRole('checkbox', { name: /Ana Martín/ })).not.toBeChecked()
  })

  test('bloquea el guardado si no ha podido consultar la asistencia real', async () => {
    render(<AttendanceView {...common()} onLoadBasis={async () => { throw new Error('Sin conexión') }} />)
    await screen.findByText('Sin conexión')
    expect(screen.getByRole('button', { name: 'Guardar asistencia' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Reintentar carga de asistencia' })).toBeEnabled()
  })
})
