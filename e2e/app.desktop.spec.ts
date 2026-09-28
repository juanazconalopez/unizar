import { expect, test } from '@playwright/test'

test('desktop keeps the sidebar and content layout usable', async ({ page }) => {
  await page.goto('/')
  const sidebar = page.locator('.sidebar')
  const content = page.locator('.content')
  await expect(sidebar).toBeVisible()
  await expect(page.locator('.mobile-nav')).toBeHidden()

  const sidebarBox = await sidebar.boundingBox()
  const contentBox = await content.boundingBox()
  expect(sidebarBox).not.toBeNull()
  expect(contentBox).not.toBeNull()
  expect(contentBox!.x).toBeGreaterThanOrEqual(sidebarBox!.x + sidebarBox!.width)

  await sidebar.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Encuestas' }).click()
  await expect(page.getByRole('heading', { name: 'Encuestas', exact: true })).toBeVisible()
})

test('desktop shows up to three season rosters per row', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('menuitem', { name: 'Temporadas' }).click()
  await page.locator('.season-card').first().getByRole('button', { name: 'Gestionar equipos' }).click()

  const dialog = page.getByRole('dialog', { name: 'Equipos' })
  const cards = dialog.locator('.season-team-roster-card')
  const firstTwo = await cards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()))
  expect(firstTwo).toHaveLength(2)
  expect(firstTwo[1].x).toBeGreaterThan(firstTwo[0].right - 1)
  expect(Math.abs(firstTwo[1].y - firstTwo[0].y)).toBeLessThan(2)

  async function addTeam(name: string) {
    await dialog.getByRole('button', { name: 'Nuevo equipo' }).click()
    await dialog.getByLabel('Nombre').fill(name)
    await dialog.getByRole('button', { name: 'Guardar equipo' }).click()
    await expect(dialog.getByRole('region', { name: `${name}, 0 jugadoras` })).toBeVisible()
  }

  await addTeam('Unizar C')
  const firstThree = await cards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()))
  expect(firstThree).toHaveLength(3)
  expect(firstThree[2].x).toBeGreaterThan(firstThree[1].right - 1)
  expect(Math.abs(firstThree[2].y - firstThree[0].y)).toBeLessThan(2)

  await addTeam('Unizar D')
  const firstFour = await cards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()))
  expect(firstFour).toHaveLength(4)
  expect(Math.abs(firstFour[3].x - firstFour[0].x)).toBeLessThan(2)
  expect(firstFour[3].y).toBeGreaterThan(firstFour[0].bottom - 1)

  await dialog.getByRole('button', { name: 'Editar equipo Unizar C' }).click()
  for (const name of ['Grupo mixto', 'Equipo activo']) {
    const checkbox = dialog.getByRole('checkbox', { name })
    const checkboxBox = await checkbox.boundingBox()
    const labelBox = await checkbox.locator('..').boundingBox()
    expect(checkboxBox).not.toBeNull()
    expect(labelBox).not.toBeNull()
    expect(checkboxBox!.width).toBeLessThanOrEqual(20)
    expect(labelBox!.width).toBeLessThan(150)
    expect(checkboxBox!.x - labelBox!.x).toBeLessThan(2)
  }
})

test('desktop player profile keeps its actions menu inside the dialog', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('menuitem', { name: 'Equipo' }).click()
  await page.getByRole('button', { name: 'Ver datos de Claudia Pérez' }).click()

  const dialog = page.getByRole('dialog', { name: 'Claudia Pérez' })
  await dialog.getByRole('button', { name: 'Acciones de Claudia Pérez' }).click()
  const menu = dialog.locator('.team-member-actions-menu')
  await expect(menu.getByRole('button', { name: 'Editar datos' })).toBeVisible()
  const dialogBox = await dialog.boundingBox()
  const menuBox = await menu.boundingBox()
  expect(menuBox).not.toBeNull()
  expect(dialogBox).not.toBeNull()
  expect(menuBox!.x).toBeGreaterThanOrEqual(dialogBox!.x)
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width)
  await menu.getByRole('button', { name: 'Editar datos' }).click()
  await expect(dialog.getByText('Fotografía de perfil')).toBeVisible()
  await expect(dialog.locator('.team-member-profile-summary')).toHaveCount(0)
})

test('desktop training editor scrolls only its form and keeps the session summary fixed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Entrenamientos' }).click()
  await page.getByRole('button', { name: /Editar entrenamiento/ }).first().click()

  const heading = page.locator('.training-editor-heading')
  const editorScroll = page.locator('.training-editor-scroll')
  const editorActions = page.locator('.training-editor-actions')
  const initialHeadingTop = (await heading.boundingBox())?.y
  await expect(editorActions).toHaveCSS('position', 'static')
  expect(await editorActions.evaluate((element) => element.closest('.training-editor-scroll') !== null)).toBe(true)
  await editorScroll.hover()
  await page.mouse.wheel(0, 900)

  await expect.poll(async () => editorScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  expect(await page.locator('.content').evaluate((element) => element.scrollTop)).toBe(0)
  expect((await heading.boundingBox())?.y).toBe(initialHeadingTop)
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientHeight))

  await editorScroll.evaluate((element) => { element.scrollTop = element.scrollHeight })
  const scrollBox = await editorScroll.boundingBox()
  const actionsBox = await editorActions.boundingBox()
  expect((actionsBox?.y ?? 0) + (actionsBox?.height ?? 0)).toBeLessThanOrEqual((scrollBox?.y ?? 0) + (scrollBox?.height ?? 0))
})

test('desktop calendar presents daily groups in the agreed order', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Calendario' }).click()
  const calendar = page.getByRole('region', { name: 'Calendario de planificación' })
  await calendar.getByRole('button', { name: /^8 de septiembre:/ }).click()

  await page.getByRole('button', { name: 'Añadir' }).click()
  await page.getByRole('menuitem', { name: 'Nuevo aviso' }).click()
  const announcementDialog = page.getByRole('dialog', { name: 'Crear aviso' })
  await announcementDialog.getByLabel('Título').fill('Aviso para validar el orden diario')
  await announcementDialog.getByLabel('Descripción').fill('Contenido de prueba para la agenda del día.')
  await announcementDialog.getByRole('button', { name: 'Crear aviso' }).click()

  await page.getByRole('button', { name: 'Añadir' }).click()
  await page.getByRole('menuitem', { name: 'Nuevo partido' }).click()
  const matchDialog = page.getByRole('dialog', { name: 'Nuevo partido' })
  await matchDialog.getByLabel('Rival').fill('Rival de prueba E2E')
  await matchDialog.getByRole('button', { name: 'Guardar partido' }).click()

  const headings = await page.locator('.selected-planning-week .task-week-heading h2').allTextContents()
  expect(headings.slice(0, 5)).toEqual(['Avisos', 'Resultados de encuestas', 'Entrenamientos', 'Partidos', '7 sept – 13 sept 2026'])
})

test('player opens survey results from calendar and remains there after closing', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ver como').selectOption('player')
  await page.getByRole('button', { name: 'Calendario' }).click()
  const calendar = page.getByRole('region', { name: 'Calendario de planificación' })
  await calendar.getByRole('button', { name: /^8 de septiembre:/ }).click()

  await page.getByRole('button', { name: /Disponibilidad para concentración/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Disponibilidad para concentración' })
  await expect(dialog).toContainText('17 de 18 jugadoras')
  await dialog.getByRole('button', { name: 'Cerrar resultados' }).click()

  await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Disponibilidad para concentración' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Encuestas', exact: true })).toHaveCount(0)
})

test('player can update an active survey from its calendar card', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ver como').selectOption('player')
  await page.getByRole('button', { name: 'Calendario' }).click()

  await page.getByRole('button', { name: 'Modificar respuesta' }).click()
  const dialog = page.getByRole('dialog', { name: 'Disponibilidad para dos convocatorias' })
  await expect(dialog.getByRole('button', { name: 'Guardar cambios' })).toBeVisible()
  await expect(dialog.getByLabel('Disponible seguro').first()).toBeChecked()
  await expect(dialog.getByRole('button', { name: 'Responder más tarde y cerrar encuesta' })).toHaveClass(/primary-button/)
  await expect(dialog.getByRole('button', { name: 'Cerrar encuesta', exact: true })).toHaveCount(0)
})

test('desktop survey filtering returns to aggregate results after clearing', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Encuestas' }).click()
  await page.getByRole('button', { name: /Valoración del inicio de temporada/ }).click()

  const dialog = page.getByRole('dialog', { name: /Valoración del inicio de temporada/ })
  await dialog.getByPlaceholder('Buscar jugadora de la temporada…').fill('Lucía Moreno')
  await expect(dialog).toContainText('no ha respondido a la encuesta')
  await expect(dialog.getByRole('button', { name: 'Guardar PDF' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Quitar filtro de jugadora' }).click()
  await expect(dialog).toContainText('14 de 18 jugadoras')
  await expect(dialog.getByRole('button', { name: 'Guardar PDF' })).toBeVisible()
})

test('desktop role navigation respects owner, coach, management and player access', async ({ page }) => {
  await page.goto('/')
  const sidebar = page.locator('.sidebar')
  await expect(sidebar.getByRole('button', { name: 'Ajustes' })).toBeVisible()

  await page.getByLabel('Ver como').selectOption('coach')
  await expect(sidebar.getByRole('button', { name: 'Gestión' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Ajustes' })).toHaveCount(0)

  await page.getByLabel('Ver como').selectOption('viewer')
  await expect(sidebar.getByRole('button', { name: 'Resumen' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Calendario' })).toHaveCount(0)

  await page.getByLabel('Ver como').selectOption('player')
  await expect(sidebar.getByRole('button', { name: 'Calendario' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Gestión' })).toHaveCount(0)
  await expect(sidebar.getByRole('button', { name: 'Ajustes' })).toHaveCount(0)
})
