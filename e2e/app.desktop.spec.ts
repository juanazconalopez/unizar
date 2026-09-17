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
