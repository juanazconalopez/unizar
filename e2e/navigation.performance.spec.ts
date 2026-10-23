import { expect, test, type Page } from '@playwright/test'
import { makeProfile, makeProfilePrivateDetails, makeSeason } from '../src/test/fixtures'
import { PERMISSIONS } from '../src/lib/permissions'

async function startApp(page: Page, owner: boolean) {
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00Z'))
  const profile = makeProfile({ id: '11111111-1111-4111-8111-111111111111', is_owner: owner })
  const paths: string[] = []
  let latency = 75
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const url = new URL(route.request().url())
    paths.push(url.pathname + url.search)
    await new Promise((resolve) => setTimeout(resolve, latency))
    const name = url.pathname.split('/').at(-1)
    let data: unknown = []
    if (name === 'profiles') data = url.searchParams.has('id') ? profile : [profile]
    if (name === 'profile_private_details') data = [makeProfilePrivateDetails({ profile_id: profile.id })]
    if (name === 'competition_seasons') data = [{ id: 'current', name: '2026–27', starts_on: '2026-08-01', source_label: 'MatchReady', synced_at: '2026-10-21T10:00:00Z' }]
    if (name === 'seasons') data = [makeSeason({ start_date: '2026-08-01', end_date: '2027-06-30' })]
    if (name === 'get_my_permissions') data = [PERMISSIONS.dashboard.personal, PERMISSIONS.calendar.personal, PERMISSIONS.calendar.trainingView, PERMISSIONS.calendar.trainingRespond, PERMISSIONS.trainingGroups.view, PERMISSIONS.workGroups.view, PERMISSIONS.videoAnalysis.view, PERMISSIONS.library.view]
    if (name === 'get_training_attendance_basis') data = { recorded: false, attended_player_ids: [], responses: [] }
    if (name === 'get_training_group_summary') data = { blocks: [], own_groups: [] }
    if (name === 'get_training_group_workspace') data = { candidates: [], members: [], draft: null }
    if (name === 'get_work_group_workspace') data = { version: 0, initial_derby_id: null, candidates: [], members: [], matches: [], assignments: [] }
    await route.fulfill({ json: data }).catch(() => undefined)
  })
  await page.addInitScript((id) => {
    const expires = Math.floor(Date.now() / 1000) + 3600
    const jwt = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: id, exp: expires, role: 'authenticated' }))}.test-signature`
    localStorage.setItem('sb-127-auth-token', JSON.stringify({
      access_token: jwt, refresh_token: 'test-refresh-token', token_type: 'bearer',
      expires_at: expires, expires_in: 3600, user: { id, email: 'navigation@example.com', aud: 'authenticated' },
    }))
  }, profile.id)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Hola|equipo|Inicio/i }).first()).toBeVisible({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  return { paths, slowDown: () => { latency = 1800 } }
}

test('all prepared sections remain immediately usable after prolonged idle and a slow focus refresh', async ({ page }, info) => {
  test.setTimeout(60_000)
  const { paths, slowDown } = await startApp(page, true)
  const ownProfileCalls = () => paths.filter((path) => path.includes('/profiles?') && path.includes('id=eq.')).length
  expect(ownProfileCalls()).toBe(1)
  const nav = page.getByRole('navigation', { name: info.project.name.includes('mobile') ? 'Navegación móvil' : 'Navegación principal', exact: true })
  const sections = ['Calendario', 'Partidos', 'Asistencia de hoy', 'Grupos de entrenamiento', 'Grupos de trabajo', 'Asignación de vídeo análisis', 'Entrenamientos', 'Encuestas', 'Resumen', 'Competición', 'Librería', 'Equipo', 'Inicio']
  const timings: { phase: string; section: string; elapsedMs: number }[] = []
  for (const phase of ['prepared', 'after-idle']) {
    if (phase === 'after-idle') {
      slowDown()
      await page.clock.setFixedTime(new Date('2026-10-21T10:20:00Z'))
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    }
    for (const section of sections) {
      const started = Date.now()
      if (['Partidos', 'Entrenamientos', 'Encuestas', 'Grupos de entrenamiento', 'Grupos de trabajo', 'Asignación de vídeo análisis'].includes(section)) {
        await nav.getByRole('button', { name: 'Gestión', exact: true }).click()
        const grouped = section.startsWith('Grupos') || section.startsWith('Asignación')
        await nav.getByRole('menuitem', { name: grouped ? 'Grupos' : section, exact: true }).click()
        if (grouped) await page.getByRole('button', { name: new RegExp(section) }).click()
      } else if (section === 'Asistencia de hoy' || section === 'Resumen') {
        await nav.getByRole('button', { name: 'Asistencia', exact: true }).click()
        await nav.getByRole('menuitem', { name: section === 'Resumen' ? 'Resumen' : 'Registrar asistencia', exact: true }).click()
      } else if (section === 'Equipo') {
        await nav.getByRole('button', { name: 'Ajustes', exact: true }).click()
        await nav.getByRole('menuitem', { name: 'Equipo', exact: true }).click()
      } else await nav.getByRole('button', { name: section, exact: true }).click()
      await expect(page.getByRole('status', { name: 'Cargando sección', exact: true })).toHaveCount(0)
      const heading = section === 'Inicio' ? /Hola|equipo|Inicio/i : section === 'Resumen' ? 'Resumen mensual' : section === 'Equipo' ? 'Ajustes - Equipo' : section
      await expect(page.getByRole('heading', { name: heading, exact: section !== 'Inicio' }).first()).toBeVisible()
      await expect(page.getByText('Cargando entrenamientos…', { exact: true })).toHaveCount(0)
      await expect(page.getByText('Cargando encuestas…', { exact: true })).toHaveCount(0)
      const elapsedMs = Date.now() - started
      expect(elapsedMs, `${phase}: ${section}`).toBeLessThan(1500)
      timings.push({ phase, section, elapsedMs })
    }
    if (phase === 'prepared') expect(ownProfileCalls()).toBe(1)
  }
  console.log(`${info.project.name}: ${JSON.stringify(timings)}`)
  await info.attach('navigation-times.json', { body: JSON.stringify(timings), contentType: 'application/json' })
  await page.screenshot({ path: info.outputPath('navigation.png'), fullPage: true })
})

test('a player prepares her permitted sections without loading private management lists', async ({ page }) => {
  const { paths } = await startApp(page, false)
  await page.getByRole('button', { name: 'Calendario', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Calendario', exact: true })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(paths.some((path) => path.includes('get_training_calendar'))).toBe(true)
  expect(paths.some((path) => path.includes('get_training_group_workspace'))).toBe(true)
  expect(paths.some((path) => path.includes('get_work_group_workspace'))).toBe(true)
  expect(paths.some((path) => path.includes('/training_plans') || path.includes('get_manage_surveys') || path.includes('role_permissions'))).toBe(false)
  expect(paths.filter((path) => path.includes('/profile_private_details')).every((path) => path.includes('profile_id=eq.11111111-1111-4111-8111-111111111111'))).toBe(true)
})
