import { expect, test } from '@playwright/test'

test('owner plans and reviews task results on mobile', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Tareas' }).click()
  await expect(page.getByRole('region', { name: 'Calendario de planificación' })).toBeVisible()
  await page.getByRole('button', { name: 'Nueva tarea en esta semana' }).click()
  await expect(page.getByRole('dialog', { name: 'Crear tarea' })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar' }).click()
  const results = page.getByRole('button', { name: 'Ver resultados' }).first()
  if (await results.isVisible()) {
    await results.click()
    await expect(page.getByRole('dialog')).toContainText('Fatiga media del equipo')
  }
})

test('player fatigue options remain horizontal on mobile', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ver como').selectOption('player')
  await page.getByRole('button', { name: 'Tareas' }).click()
  await page.getByRole('button', { name: 'Completar' }).first().click()
  const box = await page.locator('.fatigue-options').boundingBox()
  expect(box?.width).toBeGreaterThan(250)
  expect(box?.height).toBeLessThan(100)
})

test('match availability and lineup flows work on mobile', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Partidos' }).click()
  await expect(page.getByRole('heading', { name: 'Partidos', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Vista de lista' }).click()
  await page.getByRole('button', { name: 'Gestionar alineación' }).first().click()
  await expect(page.getByRole('dialog', { name: /Partido contra/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar' }).click()

  await page.getByLabel('Ver como').selectOption('player')
  await page.getByRole('button', { name: 'Partidos' }).click()
  await expect(page.getByText('Estás en duda')).toBeVisible()
  await expect(page.getByText('No asistirás')).toBeVisible()
  await page.getByRole('button', { name: 'Rechazar' }).first().click()
  await page.getByLabel('Respuesta').selectOption('doubt')
  await page.getByLabel('Comentario opcional').fill('Pendiente de revisión')
  await page.getByRole('button', { name: 'Guardar respuesta' }).click()
  await expect(page.getByText('Disponibilidad mock guardada.')).toBeVisible()
})

test('owner manages team and seasons from settings on mobile', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await expect(page.getByRole('heading', { name: 'Ajustes', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Equipo', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Temporadas' }).click()
  await expect(page.getByRole('heading', { name: 'Temporadas', exact: true })).toBeVisible()
})
