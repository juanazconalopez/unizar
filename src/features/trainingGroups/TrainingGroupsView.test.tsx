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
  const api = createDemoTrainingGroupsApi({ store, userId: players[0].player_id, canManage: true, canPublish: true, playersOn: () => players, seasonEnd: () => season.end_date })
  return { players, store, api }
}
function renderView(api: TrainingGroupsApi, canManage = true, canPublish = true) {
  return render(<TrainingGroupsView api={api} seasons={[season]} userId="demo-group-player-0" canManage={canManage} canPublish={canPublish} />)
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-21T10:00:00Z')) })
afterEach(() => vi.useRealTimers())

describe('TrainingGroupsView', () => {
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
    const { api } = setupApi()
    renderView(api,false,false)
    await screen.findByRole('region',{ name: 'Grupo ROJO' })
    expect(screen.queryByRole('button',{ name: 'Generar nuevos grupos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{ name: /^Mover a / })).not.toBeInTheDocument()
    expect(screen.queryByText('Equilibrio del reparto')).not.toBeInTheDocument()
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
