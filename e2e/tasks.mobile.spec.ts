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
