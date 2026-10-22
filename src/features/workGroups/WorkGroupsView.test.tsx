import { SessionQueryCache } from '../../services/sessionQueryCache'
import { navigationResourceKeys } from '../../services/navigationResources'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { makeSeason } from '../../test/fixtures'
import { WorkGroupsView } from './WorkGroupsView'
import { createDemoWorkGroupStore, createDemoWorkGroupsApi } from './demoWorkGroups'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
const season = makeSeason({ start_date: '2026-08-01', end_date: '2027-06-30' })
function setup(canManage = true, mode: 'work' | 'video' = 'work') {
  const store = createDemoWorkGroupStore()
  const api = createDemoWorkGroupsApi(store, canManage, [{ id: 'player-1', display_name: 'Jugadora nueva' }])
  render(<WorkGroupsView seasons={[season]} userId="player-1" canManage={canManage} api={api} mode={mode} />)
  return { store, api, user: userEvent.setup() }
}

test('mueve una integrante y vincula una nueva cuenta sin perder el resto del reparto ni el vídeo análisis', async () => {
  const { store, user } = setup()
  const before = [...store.assignments]
  await user.click(await screen.findByRole('button', { name: 'Editar Material' }))
  let modal = within(screen.getByRole('dialog', { name: 'Editar Material' }))
  await user.selectOptions(modal.getByLabelText('Grupo de Claudia Calvo'), 'botiquin')
  await user.selectOptions(modal.getByLabelText('Persona del equipo'), 'player-1')
  await user.click(modal.getByRole('button', { name: 'Añadir al grupo' }))
  await user.click(modal.getByRole('button', { name: 'Guardar grupo' }))
  await screen.findByText(/Grupo actualizado/)
  expect(store.members.find((member) => member.display_name === 'Claudia Calvo')?.group_key).toBe('botiquin')
  expect(store.members.find((member) => member.profile_id === 'player-1')).toMatchObject({ group_key: 'material', display_name: 'Jugadora nueva' })
  expect(store.assignments).toEqual(before)
  expect(screen.getByText('Tu grupo de trabajo').parentElement).toHaveTextContent('Material')
  await user.click(screen.getByRole('button', { name: 'Editar Botiquín' }))
  modal = within(screen.getByRole('dialog', { name: 'Editar Botiquín' }))
  await user.click(modal.getByRole('button', { name: 'Quitar a Claudia Calvo' }))
  await user.click(modal.getByRole('button', { name: 'Cancelar' }))
  expect(store.members.some((member) => member.display_name === 'Claudia Calvo')).toBe(true)
})

test('las jugadoras consultan las nueve tarjetas sin recibir candidatos ni controles de edición', async () => {
  const { api } = setup(false)
  await screen.findByRole('region', { name: 'Grupo de trabajo Botiquín' })
  expect(screen.getAllByRole('region', { name: /^Grupo de trabajo / })).toHaveLength(9)
  expect(screen.queryByRole('button', { name: /^Editar / })).not.toBeInTheDocument()
  expect((await api.load(season.id)).candidates).toEqual([])
})

test('guarda por partido, mantiene el derbi fijo y permite consultar solo las pendientes', async () => {
  const { store, user } = setup(true, 'video')
  await user.click(await screen.findByRole('button', { name: 'Editar asignaciones' }))
  expect(screen.queryByRole('combobox', { name: /Grupo para Unizar Femenino A vs CEFA/ })).not.toBeInTheDocument()
  const changed = store.matches[1]
  await user.selectOptions(screen.getByRole('combobox', { name: `Grupo para ${changed.title} del ${changed.match_date}` }), 'botiquin')
  await user.click(screen.getByRole('button', { name: 'Guardar asignaciones' }))
  await screen.findByText('Asignaciones de vídeo análisis guardadas.')
  expect(store.assignments.find((entry) => entry.match_id === changed.id)?.pool_key).toBe('botiquin')
  expect(store.assignments.find((entry) => entry.match_id === store.initial_derby_id)?.pool_key).toBe('merchan')
  await user.selectOptions(screen.getByLabelText('Ver grupo'), 'pending')
  expect(screen.getByText('No hay partidos con este filtro.')).toBeInTheDocument()
})

test('un conflicto de versión conserva el borrador y muestra el error', async () => {
  const { store, user } = setup()
  await user.click(await screen.findByRole('button', { name: 'Editar Material' }))
  await user.selectOptions(screen.getByLabelText('Grupo de Claudia Calvo'), 'botiquin')
  store.version += 1
  await user.click(screen.getByRole('button', { name: 'Guardar grupo' }))
  expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('El reparto ha cambiado')
  expect(screen.getByRole('button', { name: 'Guardar grupo' })).toBeEnabled()
  expect(store.members.find((member) => member.display_name === 'Claudia Calvo')?.group_key).toBe('material')
})

test('si falla la recarga después de guardar, mantiene visible el error', async () => {
  const { api, store, user } = setup()
  await user.click(await screen.findByRole('button', { name: 'Editar Material' }))
  await user.selectOptions(screen.getByLabelText('Grupo de Claudia Calvo'), 'botiquin')
  vi.spyOn(api, 'load').mockRejectedValueOnce(new Error('No se ha podido actualizar el listado.'))
  await user.click(screen.getByRole('button', { name: 'Guardar grupo' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido actualizar el listado.')
  expect(screen.queryByText(/Grupo actualizado/)).not.toBeInTheDocument()
  expect(store.members.find((member) => member.display_name === 'Claudia Calvo')?.group_key).toBe('botiquin')
})

test('keeps the prepared groups visible while reopening triggers a slow refresh', async () => {
  const api = createDemoWorkGroupsApi(createDemoWorkGroupStore(), true, [])
  const resources = new SessionQueryCache(0)
  await resources.load(navigationResourceKeys.workGroups(season.id), () => api.load(season.id))
  vi.spyOn(api, 'load').mockImplementation(() => new Promise(() => undefined))
  render(<WorkGroupsView resources={resources} seasons={[season]} userId="player-1" canManage api={api} />)
  expect(screen.getByRole('region', { name: 'Grupo de trabajo Botiquín' })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'Cargando sección' })).not.toBeInTheDocument()
})

test('a late refresh preserves the version of the workspace being edited', async () => {
  const api = createDemoWorkGroupsApi(createDemoWorkGroupStore(), true, [])
  const resources = new SessionQueryCache(0)
  const prepared = await api.load(season.id)
  await resources.load(navigationResourceKeys.workGroups(season.id), () => Promise.resolve(prepared))
  let finishRefresh!: (workspace: typeof prepared) => void
  vi.spyOn(api, 'load').mockImplementationOnce(() => new Promise((resolve) => { finishRefresh = resolve }))
  const save = vi.spyOn(api, 'saveMembers')
  render(<WorkGroupsView resources={resources} seasons={[season]} userId="player-1" canManage api={api} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Editar Material' }))
  await user.selectOptions(screen.getByLabelText('Grupo de Claudia Calvo'), 'botiquin')
  await act(async () => { finishRefresh({ ...prepared, version: prepared.version + 1 }) })
  await user.click(screen.getByRole('button', { name: 'Guardar grupo' }))
  expect(save).toHaveBeenCalledWith(season.id, prepared.version, expect.any(Array))
})
