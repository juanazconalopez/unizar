import { expect, test } from '@playwright/test'
import { makeProfile, makeProfilePrivateDetails, makeSeason } from '../src/test/fixtures'

test('prepared sections open without a blocking loader or repeat identity requests', async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date('2026-10-21T10:00:00Z'))
  const profile = makeProfile({ id: '11111111-1111-4111-8111-111111111111', is_owner: true })
  const paths: string[] = []
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const url = new URL(route.request().url())
    paths.push(url.pathname + url.search)
    // Artificial latency makes an accidental reload visible and testable.
    await new Promise((resolve) => setTimeout(resolve, 150))
    const name = url.pathname.split('/').at(-1)
    let data: unknown = []
    if (name === 'profiles') data = url.searchParams.has('id') ? profile : [profile]
    if (name === 'profile_private_details') data = [makeProfilePrivateDetails({ profile_id: profile.id })]
    if (name === 'seasons') data = [makeSeason({ start_date: '2026-08-01', end_date: '2027-06-30' })]
    if (name === 'get_training_group_summary') data = { blocks: [], own_groups: [] }
    if (name === 'get_training_group_workspace') data = { candidates: [], members: [], draft: null }
    await route.fulfill({ json: data })
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
  await expect(page.getByRole('heading', { name: /Hola|equipo|Inicio/i }).first()).toBeVisible()
  await expect.poll(() => paths.some((path) => path.includes('get_training_group_workspace'))).toBe(true)
  await page.waitForLoadState('networkidle')
  const ownProfileCalls = () => paths.filter((path) => path.includes('/profiles?') && path.includes('id=eq.')).length
  expect(ownProfileCalls()).toBe(1)
  const nav = page.getByRole('navigation', { name: testInfo.project.name.includes('mobile') ? 'Navegación móvil' : 'Navegación principal', exact: true })
  const timings: { section: string; elapsedMs: number }[] = []
  for (const section of ['Calendario', 'Partidos', 'Asistencia de hoy', 'Grupos de entrenamiento', 'Inicio', 'Calendario', 'Partidos', 'Inicio']) {
    const started = Date.now()
    if (section === 'Partidos' || section === 'Grupos de entrenamiento') {
      await nav.getByRole('button', { name: 'Gestión', exact: true }).click()
      await nav.getByRole('menuitem', { name: section === 'Grupos de entrenamiento' ? 'Grupos' : section, exact: true }).click()
      if (section === 'Grupos de entrenamiento') await page.getByRole('button', { name: /EL EQUIPO EN EL CAMPO/ }).click()
    } else if (section === 'Asistencia de hoy') {
      await nav.getByRole('button', { name: 'Asistencia', exact: true }).click()
      await nav.getByRole('menuitem', { name: 'Registrar asistencia', exact: true }).click()
    } else await nav.getByRole('button', { name: section, exact: true }).click()
    await expect(page.getByRole('status', { name: 'Cargando sección', exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: section === 'Inicio' ? /Hola|equipo|Inicio/i : section, exact: section !== 'Inicio' }).first()).toBeVisible()
    timings.push({ section, elapsedMs: Date.now() - started })
  }
  expect(ownProfileCalls()).toBe(1)
  console.log(`${testInfo.project.name}: ${JSON.stringify(timings)}`)
  await testInfo.attach('navigation-times.json', { body: JSON.stringify(timings), contentType: 'application/json' })
  await page.screenshot({ path: testInfo.outputPath('navigation.png'), fullPage: true })
})
