import { SessionQueryCache } from '../../services/sessionQueryCache'
import { navigationResourceKeys } from '../../services/navigationResources'
import { fetchGroupState } from './trainingGroupState'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { makeSeason } from '../../test/fixtures'
import { createDemoTrainingGroupsApi, createDemoTrainingGroupStore, demoExtraGroupPlayers } from './demoTrainingGroups'
import { TrainingGroupsView } from './TrainingGroupsView'
import { TrainingGroupCard } from './TrainingGroupCard'
import type { TrainingGroupsApi } from './types'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
const season = makeSeason()
function setupApi() {
  const players = demoExtraGroupPlayers()
  const store = createDemoTrainingGroupStore(season.id, season.start_date, players)
  const api = createDemoTrainingGroupsApi({ store, userId: players[0].player_id, canManage: true, canPublish: true, playersOn: () => [...players], seasonEnd: () => season.end_date })
  return { players, store, api }
}
function renderView(api: TrainingGroupsApi, canManage = true, canPublish = true) {
  return render(<TrainingGroupsView api={api} seasons={[season]} userId="demo-group-player-0" canManage={canManage} canPublish={canPublish} />)
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-21T10:00:00Z')) })
afterEach(() => vi.useRealTimers())

describe('TrainingGroupsView', () => {
  test('shows the prepared distribution immediately while its expired data refreshes', async () => {
    const { api } = setupApi()
    const resources = new SessionQueryCache(0)
    const prepared = await fetchGroupState(api, season, true)
    await resources.load(navigationResourceKeys.trainingGroups(season.id, true), () => Promise.resolve(prepared))
    vi.spyOn(api, 'summary').mockImplementation(() => new Promise(() => undefined))
    render(<TrainingGroupsView resources={resources} api={api} seasons={[season]} userId="demo-group-player-0" canManage canPublish />)
    expect(screen.getByText('Toca rehacer los grupos')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Cargando sección' })).not.toBeInTheDocument()
  })

  test('a pending background refresh cannot close a review started from the prepared distribution', async () => {
    const { api } = setupApi()
    const resources = new SessionQueryCache(0)
    const prepared = await fetchGroupState(api, season, true)
    await resources.load(navigationResourceKeys.trainingGroups(season.id, true), () => Promise.resolve(prepared))
    let finishRefresh!: (summary: typeof prepared.summary) => void
    vi.spyOn(api, 'summary').mockImplementationOnce(() => new Promise((resolve) => { finishRefresh = resolve }))
    render(<TrainingGroupsView resources={resources} api={api} seasons={[season]} userId="demo-group-player-0" canManage canPublish />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Revisar reparto' }))
    await user.click(screen.getAllByRole('button', { name: /^Mover a / })[0])
    await act(async () => { finishRefresh(prepared.summary) })
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeEnabled()
    expect(screen.getByText('Borrador · Solo visible para el staff')).toBeInTheDocument()
  })

  test('generates a balanced draft, allows manual changes, saves and confirms publication', async () => {
    const user = userEvent.setup()
    const { api, store } = setupApi()
    const save = vi.spyOn(api,'saveDraft')
    const publish = vi.spyOn(api,'publish')
    renderView(api)
    await screen.findByText('Toca rehacer los grupos')
    await user.click(screen.getByRole('button',{ name: 'Generar nuevos grupos' }))
    await screen.findByText('Equilibrio del reparto')
    expect(screen.getByText(/Reparto equilibrado:/)).toBeInTheDocument()
    const firstMove = screen.getAllByRole('button',{ name: /^Mover a / })[0]
    await user.click(firstMove)
    await user.click(screen.getByRole('button',{ name: 'Guardar borrador' }))
    await screen.findByText(/Borrador guardado/)
    expect(save).toHaveBeenCalledOnce()
    expect(store.blocks.filter((block) => block.status === 'published')).toHaveLength(1)
    await user.click(screen.getByRole('button',{ name: 'Publicar grupos' }))
    const dialog = screen.getByRole('dialog',{ name: 'Publicar grupos de entrenamiento' })
    expect(publish).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button',{ name: 'Confirmar publicación' }))
    await screen.findByText(/Grupos publicados/)
    expect(publish).toHaveBeenCalledOnce()
    expect(store.blocks.filter((block) => block.status === 'published')).toHaveLength(2)
    expect(screen.queryByRole('button',{ name: 'Guardar borrador' })).not.toBeInTheDocument()
  })
  test('a published revision leaves the old groups visible until publication and notifies every player again', async () => {
    const { api, store, players } = setupApi()
    const block = store.blocks[0]
    const before = structuredClone(store.members[block.id])
    const proposal = before.map((entry) => ({ player_id: entry.player_id, color: entry.player_id === players[0].player_id ? entry.color === 'red' ? 'white' as const : 'red' as const : entry.color }))
    await api.saveDraft({ seasonId: season.id, startsOn: block.starts_on, members: proposal, blockId: block.id, expectedVersion: block.version })
    expect(store.members[block.id]).toEqual(before)
    const view = renderView(api)
    const notice = await screen.findByRole('status', { name: 'Tu grupo en este reparto' })
    const publishedColor = before.find((entry) => entry.player_id === players[0].player_id)!.color
    expect(notice).toHaveTextContent(`Tu grupo publicado es el ${publishedColor === 'red' ? 'ROJO' : 'BLANCO'}`)
    view.unmount()
    const playerApi = createDemoTrainingGroupsApi({ store, userId: players[0].player_id, canManage: false, canPublish: false, playersOn: () => players, seasonEnd: () => season.end_date })
    expect((await playerApi.summary(season.id)).blocks[0].has_draft).toBe(false)
    expect((await playerApi.workspace(season.id,block.id,block.starts_on)).draft).toBeNull()
    await api.publish(block.id,block.version)
    expect(store.members[block.id].find((entry) => entry.player_id === players[0].player_id)?.notified_at).not.toBe(before.find((entry) => entry.player_id === players[0].player_id)?.notified_at)
    expect(new Set(store.members[block.id].map((entry) => entry.notified_at))).toEqual(new Set([store.members[block.id][0].notified_at]))
    const firstPublicationNotice = store.members[block.id][0].notified_at
    await api.saveDraft({ seasonId: season.id, startsOn: block.starts_on, members: store.members[block.id].map(({ player_id, color }) => ({ player_id, color })), blockId: block.id, expectedVersion: block.version })
    await api.publish(block.id,block.version)
    expect(store.members[block.id][0].notified_at).not.toBe(firstPublicationNotice)
    await expect(api.publish(block.id,1)).rejects.toThrow(/Otro entrenador/)
  })
  test('shows one latest published group set with a single start date line, including expired groups', async () => {
    const { api, store, players } = setupApi()
    const current = store.blocks[0]
    const ownMember = store.members[current.id].find((member) => member.player_id === players[0].player_id)!
    ownMember.color = 'white'
    const view = renderView(api, false, false)
    const currentNotice = await screen.findByRole('status', { name: 'Tu grupo en este reparto' })
    expect(currentNotice).toHaveTextContent('Perteneces al grupo BLANCO')
    expect(screen.getByText('29 sept 2026', { exact: true })).toBeInTheDocument()
    expect(screen.queryByLabelText('Temporada')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Reparto')).not.toBeInTheDocument()
    expect(screen.queryByText(/Creado el/)).not.toBeInTheDocument()
    view.unmount()

    const futureMembers = store.members[current.id].map(({ player_id, color }) => ({ player_id, color: player_id === players[0].player_id ? 'red' as const : color }))
    const futureId = await api.saveDraft({ seasonId: season.id, startsOn: '2026-10-26', members: futureMembers })
    await api.publish(futureId, 1)
    renderView(api, false, false)
    expect(await screen.findByText('Desde el 26 oct pertenecerás al grupo ROJO')).toBeInTheDocument()
    expect(screen.getByText('26 oct 2026')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Grupo ROJO' })).getByText(`${players[0].display_name} · Tú`)).toBeInTheDocument()
  })

  test('read-only roles only see published rosters and no management controls', async () => {
    const { api, players } = setupApi()
    players.push({ ...players[1], player_id: 'late-arrival', display_name: 'Nueva incorporación' })
    renderView(api,false,false)
    await screen.findByRole('region',{ name: 'Grupo ROJO' })
    expect(screen.queryByRole('button',{ name: 'Generar nuevos grupos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{ name: /^Mover a / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{ name: /^Quitar a |^Añadir a / })).not.toBeInTheDocument()
    expect(screen.queryByRole('region',{ name: 'Jugadoras sin grupo' })).not.toBeInTheDocument()
    expect(screen.queryByText('Equilibrio del reparto')).not.toBeInTheDocument()
  })

  test.each([{ role: 'owner', canPublish: true }, { role: 'entrenador', canPublish: false }])('muestra las altas bajo la renovación y permite añadirlas directamente como $role', async ({ canPublish }) => {
    const { api, store, players } = setupApi()
    const user = userEvent.setup()
    const block = store.blocks[0]
    const original = structuredClone(store.members[block.id])
    const newcomer = { ...players[1], player_id: 'late-arrival', display_name: 'Nueva incorporación' }
    players.push(newcomer)
    renderView(api, true, canPublish)

    const unassigned = await screen.findByRole('region', { name: 'Jugadoras sin grupo' })
    expect(screen.getByText('Toca rehacer los grupos').closest('.training-group-renewal')?.nextElementSibling).toBe(unassigned)
    expect(within(unassigned).getByText(newcomer.display_name)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).not.toBeInTheDocument()
    await user.click(within(unassigned).getByRole('button', { name: 'Añadir a Nueva incorporación al grupo BLANCO' }))
    expect(screen.queryByRole('region', { name: 'Jugadoras sin grupo' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Grupo BLANCO' })).getByText(newcomer.display_name)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await screen.findByText(/Borrador guardado/)
    expect(block.draft).toEqual([...original.map(({ player_id, color }) => ({ player_id, color })), { player_id: newcomer.player_id, color: 'white' }])
    expect(store.members[block.id]).toEqual(original)
    expect(block.starts_on).toBe('2026-09-29')
    if (canPublish) {
      await user.click(screen.getByRole('button', { name: 'Publicar grupos' }))
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar publicación' }))
      await screen.findByText(/Grupos publicados/)
      expect(store.members[block.id].find((entry) => entry.player_id === newcomer.player_id)?.color).toBe('white')
      for (const previous of original) expect(store.members[block.id].find((entry) => entry.player_id === previous.player_id)?.color).toBe(previous.color)
    } else expect(screen.queryByRole('button', { name: 'Publicar grupos' })).not.toBeInTheDocument()
  })

  test('al generar nuevos grupos incluye las incorporaciones sin asignación manual', async () => {
    const { api, store, players } = setupApi()
    const user = userEvent.setup()
    const newcomers = [
      { ...players[1], player_id: 'late-regional', display_name: 'Nueva con ficha' },
      { ...players[1], player_id: 'late-training', display_name: 'Nueva de entrenamientos', team_id: null, team_name: 'Solo entrenamientos' },
    ]
    players.push(...newcomers)
    renderView(api)
    const unassigned = await screen.findByRole('region', { name: 'Jugadoras sin grupo' })
    expect(within(unassigned).getAllByRole('listitem')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Generar nuevos grupos' }))
    await screen.findByText('Equilibrio del reparto')
    expect(screen.queryByRole('region', { name: 'Jugadoras sin grupo' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Mover a / })).toHaveLength(players.length)
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await screen.findByText(/Borrador guardado/)
    const draft = store.blocks.find((item) => item.status === 'draft')!
    for (const newcomer of newcomers) expect(draft.draft).toContainEqual({ player_id: newcomer.player_id, color: expect.stringMatching(/^(red|white)$/) })
  })

  test('incorpora un alta individual y retira otra jugadora del mismo reparto sin cambiar a las demás', async () => {
    const { api, store, players } = setupApi()
    const user = userEvent.setup()
    const block = store.blocks[0]
    const original = structuredClone(store.members[block.id])
    const view = renderView(api)
    await user.click(await screen.findByRole('button', { name: 'Revisar reparto' }))
    const newcomer = { ...players[1], player_id: 'late-arrival', display_name: 'Nueva incorporación' }
    players.push(newcomer)
    const workspace = vi.spyOn(api, 'workspace')
    await user.click(screen.getByRole('button', { name: 'Actualizar plantilla' }))
    const unassigned = await screen.findByRole('region', { name: 'Jugadoras sin grupo' })
    expect(within(unassigned).getByText(newcomer.display_name)).toBeInTheDocument()
    expect(workspace).toHaveBeenLastCalledWith(season.id, block.id, block.starts_on, true)
    expect(screen.getAllByRole('button', { name: /^Mover a / })).toHaveLength(original.length)
    await user.click(within(unassigned).getByRole('button', { name: 'Añadir a Nueva incorporación al grupo BLANCO' }))
    await user.click(screen.getByRole('button', { name: `Quitar a ${players[0].display_name} del reparto` }))
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await screen.findByText(/Borrador guardado/)
    expect(store.members[block.id]).toEqual(original)
    expect(block.draft).toHaveLength(original.length)
    expect(block.draft).toContainEqual({ player_id: newcomer.player_id, color: 'white' })
    expect(block.draft!.some((entry) => entry.player_id === players[0].player_id)).toBe(false)
    view.unmount()

    renderView(api)
    await screen.findByRole('region', { name: 'Jugadoras sin grupo' })
    expect(within(screen.getByRole('region', { name: 'Jugadoras sin grupo' })).getByText(players[0].display_name)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Publicar grupos' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar publicación' }))
    await screen.findByText(/Grupos publicados/)
    expect(store.blocks).toHaveLength(1)
    expect(block.starts_on).toBe('2026-09-29')
    expect(store.members[block.id].find((entry) => entry.player_id === newcomer.player_id)?.color).toBe('white')
    expect(store.members[block.id].some((entry) => entry.player_id === players[0].player_id)).toBe(false)
    for (const previous of original.filter((entry) => entry.player_id !== players[0].player_id)) expect(store.members[block.id].find((entry) => entry.player_id === previous.player_id)?.color).toBe(previous.color)
    expect(screen.queryByRole('status', { name: 'Tu grupo en este reparto' })).not.toBeInTheDocument()
  })

  test('actualizar la plantilla conserva las retiradas y movimientos sin guardar', async () => {
    const { api, players } = setupApi()
    const user = userEvent.setup()
    renderView(api)
    await user.click(await screen.findByRole('button', { name: 'Revisar reparto' }))
    await user.click(screen.getByRole('button', { name: `Quitar a ${players[0].display_name} del reparto` }))
    const move = screen.getByRole('button', { name: new RegExp(`^Mover a ${players[1].display_name} al grupo`) })
    const newColor = move.getAttribute('aria-label')!.endsWith('ROJO') ? 'ROJO' : 'BLANCO'
    await user.click(move)
    await user.click(screen.getByRole('button', { name: 'Actualizar plantilla' }))
    await screen.findByText(/Plantilla actualizada/)
    expect(within(screen.getByRole('region', { name: 'Jugadoras sin grupo' })).getByText(players[0].display_name)).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: `Grupo ${newColor}` })).getByText(players[1].display_name)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar borrador' })).toBeEnabled()
  })

  test('permite retirar la última jugadora y publicar el reparto vacío', async () => {
    const players = demoExtraGroupPlayers().slice(0, 1)
    const store = createDemoTrainingGroupStore(season.id, season.start_date, players)
    const block = store.blocks[0]
    const api = createDemoTrainingGroupsApi({ store, userId: players[0].player_id, canManage: true, canPublish: true, playersOn: () => players, seasonEnd: () => season.end_date })
    const user = userEvent.setup()
    renderView(api)
    await user.click(await screen.findByRole('button', { name: 'Revisar reparto' }))
    await user.click(screen.getByRole('button', { name: `Quitar a ${players[0].display_name} del reparto` }))
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await screen.findByText(/Borrador guardado/)
    expect(block.draft).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Publicar grupos' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar publicación' }))
    await screen.findByText('No hay jugadoras asignadas en este reparto.')
    expect(store.members[block.id]).toEqual([])
    expect(block.status).toBe('published')
  })

  test('al perder elegibilidad entre guardado y publicación, exige retirar la asignación obsoleta', async () => {
    const { api, players, store } = setupApi()
    const block = store.blocks[0]
    const members = store.members[block.id].map(({ player_id, color }) => ({ player_id, color }))
    await api.saveDraft({ seasonId: season.id, startsOn: block.starts_on, members, blockId: block.id, expectedVersion: block.version })
    const departed = players.shift()!
    await expect(api.publish(block.id, block.version)).rejects.toThrow(/La plantilla ha cambiado/)
    expect(block.draft).toBeTruthy()
    await api.saveDraft({ seasonId: season.id, startsOn: block.starts_on, members: members.filter((entry) => entry.player_id !== departed.player_id), blockId: block.id, expectedVersion: block.version })
    await api.publish(block.id, block.version)
    expect(store.members[block.id].some((entry) => entry.player_id === departed.player_id)).toBe(false)
  })
  test('keeps saved drafts when publication fails and shows an actionable conflict', async () => {
    const user = userEvent.setup()
    const { api } = setupApi()
    api.publish = vi.fn().mockRejectedValue(new Error('Otro entrenador ha modificado el reparto. Recarga para revisar sus cambios.'))
    renderView(api)
    await user.click(await screen.findByRole('button',{ name: 'Generar nuevos grupos' }))
    await user.click(await screen.findByRole('button',{ name: 'Guardar borrador' }))
    await user.click(await screen.findByRole('button',{ name: 'Publicar grupos' }))
    await user.click(screen.getByRole('button',{ name: 'Confirmar publicación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Otro entrenador')
    expect(screen.getByRole('button',{ name: 'Publicar grupos' })).toBeEnabled()
  })
})

describe('TrainingGroupCard', () => {
  test('only shows group renewal controls to staff, without showing their personal assignment', async () => {
    const { api } = setupApi()
    render(<TrainingGroupCard api={api} seasonId={season.id} userId="demo-group-player-0" canManage onOpen={vi.fn()} />)
    expect(await screen.findByRole('region',{ name: 'Renovación de grupos' })).toHaveTextContent('Toca rehacer los grupos')
    expect(screen.queryByText(/Tu grupo:/)).not.toBeInTheDocument()
    expect(screen.getByRole('button',{ name: 'Gestionar grupos' })).toBeInTheDocument()
  })
  test('does not show a group card for players', async () => {
    const { api } = setupApi()
    render(<TrainingGroupCard api={api} seasonId={season.id} userId="demo-group-player-0" onOpen={vi.fn()} />)
    await act(async () => {})
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
  })
})
