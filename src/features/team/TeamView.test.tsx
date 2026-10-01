import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { makePlayerAbsence, makeProfile, makeProfilePrivateDetails, makeProvisionalAttendance, makeProvisionalPlayer, makeSeason, makeSeasonTeam } from '../../test/fixtures'
import { TeamView } from './TeamView'

vi.mock('../profile/profilePhotoCrop', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../profile/profilePhotoCrop')>()
  return { ...actual, exportPhotoCrop: vi.fn(async () => new File(['cropped'], 'foto-perfil.jpg', { type: 'image/jpeg' })) }
})

async function prepareCrop(dialog: HTMLElement) {
  const image = await within(dialog).findByAltText('Vista previa del encuadre')
  Object.defineProperties(image, { naturalWidth: { value: 800 }, naturalHeight: { value: 1200 } })
  fireEvent.load(image)
  await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Guardar foto' })).toBeEnabled())
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('TeamView', () => {
  test('keeps the owner list compact and opens the complete read-only profile', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-31T12:00:00'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<TeamView currentUserId="owner-1" onUpdate={vi.fn()} profiles={[makeProfile({ avatar_path: 'players/ana.webp' })]} profilePrivateDetails={[makeProfilePrivateDetails()]} />)
    await user.click(screen.getByText('Jugadoras activas'))

    const card = screen.getByRole('button', { name: 'Ver datos de Ana Martín' })
    expect(card).toHaveTextContent('ana@example.com')
    expect(card).toHaveTextContent('+34 600 000 000')
    expect(card).toHaveTextContent('28 años')
    expect(card).not.toHaveTextContent('Activa')
    expect(card).not.toHaveTextContent('Jugadora')
    expect(card).not.toHaveTextContent('Faltan datos')
    expect(card.querySelector('.person-summary-absence-slot')).toBeEmptyDOMElement()
    expect(card.querySelector('.person-summary-completion-slot')).toBeEmptyDOMElement()
    expect(within(card).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desautorizar' })).not.toBeInTheDocument()

    await user.click(card)
    const dialog = screen.getByRole('dialog', { name: 'Ana Martín' })
    const summary = dialog.querySelector('.team-member-profile-summary')
    expect(summary).not.toBeNull()
    expect(summary).toHaveTextContent('+34 600 000 000')
    expect(summary).toHaveTextContent('28 años')
    expect(summary).not.toHaveTextContent('ana@example.com')
    expect(within(dialog).getByRole('link', { name: 'ana@example.com' })).toHaveAttribute('href', 'mailto:ana@example.com')
    expect(within(dialog).getByText('15 de abril de 1998')).toBeInTheDocument()
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument()
  })

  test('shows player actions in order and opens a separate sports absence dialog', async () => {
    const user = userEvent.setup()
    render(<TeamView currentUserId="owner-1" onSave={vi.fn()} onSavePhoto={vi.fn()} onSaveAbsence={vi.fn()} onUpdate={vi.fn()}
      profiles={[makeProfile()]} provisionalAttendance={[makeProvisionalAttendance()]}
      provisionalPlayers={[makeProvisionalPlayer()]} onLinkProvisionalPlayers={vi.fn()} />)
    await user.click(screen.getByText('Jugadoras activas'))

    await user.click(screen.getByRole('button', { name: 'Ver datos de Ana Martín' }))
    let dialog = screen.getByRole('dialog', { name: 'Ana Martín' })
    expect(within(dialog).queryByText('Disponibilidad deportiva')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Vincular historiales de invitadas')).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Acciones de Ana Martín' }))
    const menu = dialog.querySelector<HTMLElement>('.team-member-actions-menu')!
    expect(within(menu).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Editar datos', 'Subir foto', 'Baja deportiva', 'Vincular asistencias', 'Vista previa de jugadora', 'Cerrar',
    ])
    await user.click(within(menu).getByRole('button', { name: 'Baja deportiva' }))
    const absenceDialog = screen.getByRole('dialog', { name: 'Baja deportiva de Ana Martín' })
    expect(dialog).not.toBeInTheDocument()
    expect(within(absenceDialog).getByText(/Durante una baja/)).toBeInTheDocument()
    await user.click(within(absenceDialog).getByRole('button', { name: 'Cancelar' }))
    dialog = screen.getByRole('dialog', { name: 'Ana Martín' })
    expect(dialog).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Acciones de Ana Martín' }))
    await user.keyboard('{Escape}')
    expect(dialog.querySelector('.team-member-actions-menu')).toBeNull()
    expect(dialog).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Acciones de Ana Martín' }))
    await user.click(within(dialog.querySelector<HTMLElement>('.team-member-actions-menu')!).getByRole('button', { name: 'Cerrar' }))
    expect(dialog).not.toBeInTheDocument()
  })

  test('lets the owner save a player photo from a separate profile action', async () => {
    const user = userEvent.setup()
    const profile = makeProfile()
    const onSavePhoto = vi.fn().mockResolvedValue(undefined)
    render(<TeamView currentUserId="owner-1" onSave={vi.fn()} onSavePhoto={onSavePhoto} onUpdate={vi.fn()} profiles={[profile]} />)
    await user.click(screen.getByText('Jugadoras activas'))

    await user.click(screen.getByRole('button', { name: 'Ver datos de Ana Martín' }))
    await user.click(screen.getByRole('button', { name: 'Acciones de Ana Martín' }))
    await user.click(screen.getByRole('button', { name: 'Subir foto' }))
    const dialog = screen.getByRole('dialog', { name: 'Foto de Ana Martín' })
    const file = new File(['photo'], 'ana.png', { type: 'image/png' })
    await user.upload(within(dialog).getByLabelText('Seleccionar fotografía'), file)
    expect(await within(dialog).findByAltText('Fotografía de Ana Martín')).toHaveAttribute('src', expect.stringContaining('data:image/png;base64,'))
    await prepareCrop(dialog)
    expect(within(dialog).getByLabelText('Zoom de la fotografía')).toHaveValue('1.5')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar foto' }))

    expect(onSavePhoto).toHaveBeenCalledWith(profile, expect.objectContaining({ name: 'foto-perfil.jpg', type: 'image/jpeg' }))
    expect(screen.queryByRole('dialog', { name: 'Foto de Ana Martín' })).not.toBeInTheDocument()
  })

  test.each([
    { group: 'Entrenadores', role: { is_player: false, is_coach: true }, name: 'Andrea Entrenadora' },
    { group: 'Dirección', role: { is_player: false, is_viewer: true }, name: 'Carlos Dirección' },
    { group: 'Owners', role: { is_player: false, is_owner: true }, name: 'Lucía Owner' },
  ])('lets the owner upload a photo for an active member of $group', async ({ group, role, name }) => {
    const user = userEvent.setup()
    const profile = makeProfile({ ...role, display_name: name })
    const onSavePhoto = vi.fn().mockResolvedValue(undefined)
    render(<TeamView currentUserId="owner-1" onSavePhoto={onSavePhoto} onUpdate={vi.fn()} profiles={[profile]} />)

    await user.click(within(document.querySelector<HTMLElement>('.team-member-groups')!).getByText(group))
    await user.click(screen.getByRole('button', { name: `Ver datos de ${name}` }))
    const dialog = screen.getByRole('dialog', { name })
    expect(dialog.querySelector('.team-member-profile-summary')).not.toBeNull()
    await user.click(within(dialog).getByRole('button', { name: `Acciones de ${name}` }))
    await user.click(within(dialog).getByRole('button', { name: 'Subir foto' }))
    const photoDialog = screen.getByRole('dialog', { name: `Foto de ${name}` })
    const file = new File(['photo'], 'perfil.png', { type: 'image/png' })
    await user.upload(within(photoDialog).getByLabelText('Seleccionar fotografía'), file)
    await prepareCrop(photoDialog)
    await user.click(within(photoDialog).getByRole('button', { name: 'Guardar foto' }))
    expect(onSavePhoto).toHaveBeenCalledWith(profile, expect.objectContaining({ name: 'foto-perfil.jpg', type: 'image/jpeg' }))
  })

  test('does not offer a photo action for an inactive member', async () => {
    const user = userEvent.setup()
    const profile = makeProfile({ display_name: 'Andrea Inactiva', is_player: false, is_coach: true, is_active: false })
    render(<TeamView currentUserId="owner-1" onSavePhoto={vi.fn()} onUpdate={vi.fn()} profiles={[profile]} />)
    await user.click(screen.getByText('Entrenadores'))
    await user.click(screen.getByRole('button', { name: 'Ver datos de Andrea Inactiva' }))
    await user.click(screen.getByRole('button', { name: 'Acciones de Andrea Inactiva' }))
    expect(screen.queryByRole('button', { name: 'Subir foto' })).not.toBeInTheDocument()
  })

  test('marks only a current sporting absence in the list and shows its dates in the profile', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const active = makePlayerAbsence({ ends_on: '2026-09-27' })
    const upcoming = makePlayerAbsence({ id: 'absence-2', player_id: 'player-2', starts_on: '2026-09-28' })
    render(<TeamView currentUserId="owner-1" onUpdate={vi.fn()}
      profiles={[makeProfile(), makeProfile({ id: 'player-2', display_name: 'Laura Pérez' })]}
      playerAbsences={[active, upcoming]} />)
    await user.click(screen.getByText('Jugadoras activas'))

    const activeCard = screen.getByRole('button', { name: 'Ver datos de Ana Martín' })
    expect(within(activeCard).getByRole('img', { name: 'Baja deportiva' }).querySelector('svg')).toBeInTheDocument()
    expect(activeCard.querySelector('.person-summary-absence-slot')).toContainElement(within(activeCard).getByRole('img', { name: 'Baja deportiva' }))
    expect(activeCard).not.toHaveTextContent('Baja deportiva:')
    expect(activeCard).not.toHaveTextContent('20 sept 2026')
    expect(within(screen.getByRole('button', { name: 'Ver datos de Laura Pérez' })).queryByRole('img', { name: 'Baja deportiva' })).not.toBeInTheDocument()

    await user.click(activeCard)
    const dialog = screen.getByRole('dialog', { name: 'Ana Martín' })
    expect(within(dialog).getByRole('img', { name: 'Baja deportiva' })).toBeInTheDocument()
    const history = within(dialog).getByRole('region', { name: 'Bajas deportivas' })
    expect(history).toHaveTextContent('20 de septiembre de 2026 — 27 de septiembre de 2026')
    expect(history).toHaveTextContent('Vigente')
  })

  test('registers a sporting absence in its own dialog and returns to the profile', async () => {
    const user = userEvent.setup()
    const onSaveAbsence = vi.fn().mockResolvedValue(undefined)
    render(<TeamView currentUserId="owner-1" onUpdate={vi.fn()} onSaveAbsence={onSaveAbsence} profiles={[makeProfile()]} />)
    await user.click(screen.getByText('Jugadoras activas'))

    await user.click(screen.getByRole('button', { name: 'Ver datos de Ana Martín' }))
    await user.click(screen.getByRole('button', { name: 'Acciones de Ana Martín' }))
    await user.click(screen.getByRole('button', { name: 'Baja deportiva' }))
    const dialog = screen.getByRole('dialog', { name: 'Baja deportiva de Ana Martín' })
    fireEvent.change(within(dialog).getByLabelText('Inicio'), { target: { value: '2026-09-27' } })
    fireEvent.change(within(dialog).getByLabelText('Fin previsto'), { target: { value: '2026-10-02' } })
    await user.type(within(dialog).getByLabelText('Nota privada opcional'), 'Lesión de tobillo')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar baja' }))

    await waitFor(() => expect(onSaveAbsence).toHaveBeenCalledWith(makeProfile(), {
      startsOn: '2026-09-27', endsOn: '2026-10-02', privateNote: 'Lesión de tobillo',
    }, undefined))
    expect(screen.getByRole('dialog', { name: 'Ana Martín' })).toBeInTheDocument()
  })

  test('opens an active player preview in a separate read-only tab', async () => {
    const user = userEvent.setup()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<TeamView currentUserId="owner-1" onUpdate={vi.fn()} profiles={[makeProfile()]} />)
    await user.click(screen.getByText('Jugadoras activas'))

    await user.click(screen.getByRole('button', { name: 'Ver datos de Ana Martín' }))
    await user.click(screen.getByRole('button', { name: 'Acciones de Ana Martín' }))
    await user.click(screen.getByRole('button', { name: 'Vista previa de jugadora' }))

    expect(open).toHaveBeenCalledWith(expect.stringContaining('view=player-preview&player=player-1'), '_blank', 'noopener')
  })

  test('edits details and permissions only after opening the detail pencil', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const profile = makeProfile()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<TeamView currentUserId="owner-1" onSave={onSave} onUpdate={vi.fn()} profiles={[profile]} profilePrivateDetails={[makeProfilePrivateDetails()]} />)
    await user.click(screen.getByText('Jugadoras activas'))

    await user.click(screen.getByRole('button', { name: 'Ver datos de Ana Martín' }))
    await user.click(screen.getByRole('button', { name: 'Acciones de Ana Martín' }))
    await user.click(screen.getByRole('button', { name: 'Editar datos' }))
    const dialog = screen.getByRole('dialog', { name: 'Ana Martín' })
    expect(within(dialog).queryByLabelText('Seleccionar fotografía')).not.toBeInTheDocument()
    const name = within(dialog).getByLabelText('Nombre y apellidos')
    await user.clear(name)
    await user.type(name, 'Ana Martín López')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Entrenador' }))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }))

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('estado o los permisos'))
    expect(onSave).toHaveBeenCalledWith(profile, {
      displayName: 'Ana Martín López', phone: '+34 600 000 000', birthDate: '1998-04-15',
      isActive: true, isPlayer: true, isCoach: true, isViewer: false, isOwner: false,
    })
  })

  test('opens an accent-insensitive name search and filters every account state', async () => {
    const user = userEvent.setup()
    render(<TeamView currentUserId="owner-1" onUpdate={vi.fn()} profiles={[
      makeProfile({ id: 'maria', display_name: 'María López' }),
      makeProfile({ id: 'clara', display_name: 'Clara Pérez' }),
      makeProfile({ id: 'archived', display_name: 'María Luisa', is_approved: false, is_active: false, is_archived: true }),
    ]} />)
    await user.click(screen.getByRole('button', { name: 'Buscar personas' }))
    const search = screen.getByRole('searchbox', { name: 'Buscar por nombre' })
    expect(screen.queryByRole('button', { name: 'Cerrar búsqueda' })).not.toBeInTheDocument()
    await user.type(search, 'maria')
    expect(screen.getByText('María López')).toBeInTheDocument()
    expect(screen.getByText('María Luisa')).toBeInTheDocument()
    expect(screen.queryByText('Clara Pérez')).not.toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'sin coincidencias')
    expect(screen.getByText('No hay personas que coincidan con “sin coincidencias” dentro de los filtros actuales.')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('searchbox', { name: 'Buscar por nombre' })).not.toBeInTheDocument()
  })

  test('keeps inactive cards compact and reports combined filter results', async () => {
    const user = userEvent.setup()
    const active = makeProfile({ id: 'active', display_name: 'Ana Activa' })
    const inactive = makeProfile({ id: 'inactive', display_name: 'Paula Inactiva', is_active: false })
    const coach = makeProfile({ id: 'coach', display_name: 'Marta Entrenadora', is_player: false, is_coach: true })
    render(<TeamView currentUserId="owner-1" onUpdate={vi.fn()} profiles={[active, inactive, coach]} profilePrivateDetails={[
      makeProfilePrivateDetails({ profile_id: 'inactive', email: 'paula@example.com' }),
    ]} />)
    await user.click(screen.getByText('Jugadoras inactivas'))

    const inactiveCard = screen.getByRole('button', { name: 'Ver datos de Paula Inactiva' })
    expect(inactiveCard).not.toHaveTextContent('Jugadora')
    expect(inactiveCard).toHaveTextContent('Faltan datos')
    expect(inactiveCard).not.toHaveTextContent('paula@example.com')
    expect(screen.getByText('3 aprobados · 0 pendientes · 2 activas · 1 inactivas')).toBeInTheDocument()
    expect(screen.getByText('2 jugadoras · 1 entrenador · 0 dirección')).toBeInTheDocument()

    await user.click(document.querySelector('.team-filter-control > summary')!)
    await user.click(screen.getByRole('radio', { name: 'Inactivas' }))
    expect(screen.getByText('1 resultado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver datos de Ana Activa' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Entrenador' }))
    expect(screen.getByText('0 resultados')).toBeInTheDocument()
  })

  test('groups cumulative roles without repeating status and role pills in each row', async () => {
    const user = userEvent.setup()
    render(<TeamView currentUserId="owner-1" onUpdate={vi.fn()} profiles={[
      makeProfile({ id: 'player', display_name: 'Paula Jugadora' }),
      makeProfile({ id: 'coach', display_name: 'Clara Entrenador', is_player: false, is_coach: true }),
      makeProfile({ id: 'viewer', display_name: 'Diana Dirección', is_player: false, is_viewer: true }),
      makeProfile({ id: 'owner', display_name: 'Olga Owner', is_player: true, is_owner: true }),
    ]} />)

    for (const [title, count] of [['Jugadoras activas', '2'], ['Jugadoras inactivas', '0'], ['Entrenadores', '1'], ['Dirección', '1'], ['Owners', '1']]) {
      expect(within(document.querySelector<HTMLElement>('.team-member-groups')!).getByText(title).closest('summary')).toHaveTextContent(count)
    }
    const activeGroup = screen.getByText('Jugadoras activas').closest('details')!
    expect(activeGroup).not.toHaveAttribute('open')
    await user.click(screen.getByText('Jugadoras activas'))
    expect(activeGroup).toHaveAttribute('open')
    const player = screen.getByRole('button', { name: 'Ver datos de Paula Jugadora' })
    expect(player).not.toHaveTextContent('Activa')
    expect(player).not.toHaveTextContent('Datos completos')
    expect(within(player).queryByText('Jugadora', { exact: true })).not.toBeInTheDocument()
    expect(within(activeGroup).getByRole('button', { name: 'Ver datos de Olga Owner' })).toBeInTheDocument()
    const ownersGroup = screen.getByText('Owners').closest('details')!
    await user.click(screen.getByText('Owners'))
    expect(ownersGroup).toHaveAttribute('open')
    expect(within(ownersGroup).getByRole('button', { name: 'Ver datos de Olga Owner' })).toBeInTheDocument()
    await user.click(screen.getByText('Jugadoras activas'))
    expect(activeGroup).not.toHaveAttribute('open')
    await user.click(screen.getByText('Entrenadores'))
    expect(screen.getByRole('button', { name: 'Ver datos de Clara Entrenador' })).toBeInTheDocument()
    await user.click(within(document.querySelector<HTMLElement>('.team-member-groups')!).getByText('Dirección'))
    expect(screen.getByRole('button', { name: 'Ver datos de Diana Dirección' })).toBeInTheDocument()
  })

  test('counts a missing player photo as incomplete but does not require staff photos', async () => {
    const user = userEvent.setup()
    render(<TeamView currentUserId="owner-1" onUpdate={vi.fn()} profiles={[
      makeProfile(),
      makeProfile({ id: 'coach', display_name: 'Clara Entrenador', is_player: false, is_coach: true }),
    ]} profilePrivateDetails={[
      makeProfilePrivateDetails(),
      makeProfilePrivateDetails({ profile_id: 'coach' }),
    ]} />)

    await user.click(screen.getByText('Jugadoras activas'))
    expect(screen.getByRole('button', { name: 'Ver datos de Ana Martín' })).toHaveTextContent('Faltan datos')
    await user.click(screen.getByText('Entrenadores'))
    expect(screen.getByRole('button', { name: 'Ver datos de Clara Entrenador' })).not.toHaveTextContent('Faltan datos')
  })

  test('moves duplicate review and approval into the pending profile detail', async () => {
    const user = userEvent.setup()
    const registered = makeProfile({ id: 'registered', display_name: 'María López' })
    const pending = makeProfile({ id: 'pending', display_name: 'Maria Lopex', is_approved: false, is_active: false })
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(<TeamView currentUserId="owner-1" onUpdate={onUpdate} profiles={[registered, pending]} />)

    expect(screen.getByRole('button', { name: 'Ver datos de Maria Lopex' })).toHaveTextContent('Posible duplicado')
    await user.click(screen.getByRole('button', { name: 'Ver datos de Maria Lopex' }))
    expect(screen.getByText('Posible cuenta duplicada')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aprobar como jugadora' }))
    expect(onUpdate).toHaveBeenCalledWith({ ...pending, is_approved: true, is_active: true, is_player: true })
  })

  test('keeps restore and deauthorization inside their profile details', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const member = makeProfile({ id: 'member', display_name: 'María López' })
    const archived = makeProfile({ id: 'archived', display_name: 'Paula Romero', is_approved: false, is_active: false, is_archived: true })
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const onArchive = vi.fn().mockResolvedValue(undefined)
    render(<TeamView currentUserId="owner-1" onArchive={onArchive} onSave={vi.fn()} onUpdate={onUpdate} profiles={[member, archived]} />)
    await user.click(screen.getByText('Jugadoras activas'))

    await user.click(screen.getByRole('button', { name: 'Ver datos de María López' }))
    expect(screen.queryByRole('button', { name: 'Desautorizar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Acciones de María López' }))
    await user.click(screen.getByRole('button', { name: 'Editar datos' }))
    await user.click(screen.getByRole('button', { name: 'Desautorizar' }))
    expect(onArchive).toHaveBeenCalledWith(member)

    await user.click(screen.getByRole('button', { name: 'Ver usuarios desautorizados (1)' }))
    await user.click(screen.getByRole('button', { name: 'Ver datos de Paula Romero' }))
    await user.click(screen.getByRole('button', { name: 'Restaurar acceso' }))
    expect(onUpdate).toHaveBeenCalledWith({ ...archived, is_archived: false, is_approved: true, is_active: false })
  })

  test('lets the owner confirm and link multiple provisional attendance histories', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const profile = makeProfile({ display_name: 'Laura Invitada Pérez' })
    const guest = makeProvisionalPlayer()
    const guestWithSurname = makeProvisionalPlayer({ id: 'guest-2', display_name: 'Laura Paredes' })
    const onLink = vi.fn().mockResolvedValue(undefined)
    render(<TeamView
      currentUserId="owner-1"
      profiles={[profile]}
      provisionalAttendance={[
        makeProvisionalAttendance(),
        makeProvisionalAttendance({ session_id: 'session-2', provisional_player_id: guestWithSurname.id, training_sessions: { session_date: '2026-08-12' } }),
      ]}
      provisionalPlayers={[guest, guestWithSurname]}
      onLinkProvisionalPlayers={onLink}
      onUpdate={vi.fn()}
    />)
    await user.click(screen.getByText('Jugadoras activas'))

    await user.click(screen.getByRole('button', { name: 'Ver datos de Laura Invitada Pérez' }))
    const dialog = screen.getByRole('dialog', { name: 'Laura Invitada Pérez' })
    await user.click(within(dialog).getByRole('button', { name: 'Acciones de Laura Invitada Pérez' }))
    await user.click(within(dialog).getByRole('button', { name: 'Vincular asistencias' }))
    const linkDialog = screen.getByRole('dialog', { name: 'Vincular asistencias de Laura Invitada Pérez' })
    expect(dialog).not.toBeInTheDocument()
    await user.click(within(linkDialog).getByRole('checkbox', { name: /Laura Invitada/ }))
    await user.click(within(linkDialog).getByRole('checkbox', { name: /Laura Paredes/ }))
    expect(within(linkDialog).getByText(/Historial desde/)).toHaveTextContent('5 ago 2026')
    await user.click(within(linkDialog).getByRole('button', { name: 'Vincular asistencias' }))

    expect(window.confirm).toHaveBeenCalledWith('¿Vincular 2 invitadas (2 asistencias) con Laura Invitada Pérez?')
    expect(onLink).toHaveBeenCalledWith([guest, guestWithSurname], profile)
  })

  test('selects invited histories and a season team while approving a new player', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-27T12:00:00Z'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const pending = makeProfile({ id: 'pending', display_name: 'Laura Nueva', is_approved: false, is_active: false })
    const guest = makeProvisionalPlayer()
    const season = makeSeason()
    const defaultTeam = makeSeasonTeam()
    const otherTeam = makeSeasonTeam({ id: 'team-2', name: 'Equipo de desarrollo', is_default: false })
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const onLink = vi.fn().mockResolvedValue(undefined)
    const onAssign = vi.fn().mockResolvedValue(undefined)
    render(<TeamView
      currentUserId="owner-1"
      profiles={[pending]}
      seasons={[season]}
      seasonTeams={[defaultTeam, otherTeam]}
      provisionalAttendance={[makeProvisionalAttendance()]}
      provisionalPlayers={[guest]}
      onAssignPlayerTeam={onAssign}
      onLinkProvisionalPlayers={onLink}
      onUpdate={onUpdate}
    />)

    await user.click(screen.getByRole('button', { name: 'Ver datos de Laura Nueva' }))
    const dialog = screen.getByRole('dialog', { name: 'Laura Nueva' })
    expect(within(dialog).getByRole('region', { name: 'Vincular asistencias al autorizar' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Acciones de Laura Nueva' }))
    expect(within(dialog).queryByRole('button', { name: 'Vincular asistencias' })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('checkbox', { name: /Laura Invitada/ }))
    await user.selectOptions(within(dialog).getByLabelText('Equipo de la temporada'), otherTeam.id)
    await user.click(within(dialog).getByRole('button', { name: 'Aprobar como jugadora' }))

    expect(window.confirm).toHaveBeenCalledWith('¿Aprobar como jugadora a Laura Nueva y vincular 1 invitada (1 asistencia)?')
    expect(onUpdate).toHaveBeenCalledWith({ ...pending, is_approved: true, is_active: true, is_player: true })
    await waitFor(() => expect(onAssign).toHaveBeenCalledWith(season, pending, otherTeam.id))
    expect(onLink).toHaveBeenCalledWith([guest], pending)
    expect(onUpdate.mock.invocationCallOrder[0]).toBeLessThan(onAssign.mock.invocationCallOrder[0])
    expect(onAssign.mock.invocationCallOrder[0]).toBeLessThan(onLink.mock.invocationCallOrder[0])
  })

  test('hides the team selector when the active season has only one team', async () => {
    const user = userEvent.setup()
    const pending = makeProfile({ id: 'pending', is_approved: false, is_active: false })
    render(<TeamView currentUserId="owner-1" onAssignPlayerTeam={vi.fn()} onUpdate={vi.fn().mockResolvedValue(undefined)}
      profiles={[pending]} seasons={[makeSeason()]} seasonTeams={[makeSeasonTeam()]} />)
    await user.click(screen.getByRole('button', { name: 'Ver datos de Ana Martín' }))
    expect(screen.queryByLabelText('Equipo de la temporada')).not.toBeInTheDocument()
  })
})
