import { expect, test } from '@playwright/test'

test('owner can open the past match report form on mobile', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-24T12:00:00+02:00') })
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Partidos' }).click()
  await page.getByRole('button', { name: 'Mes anterior' }).click()
  await page.getByRole('button', { name: /: 1 partido/ }).click()
  await page.locator('.selected-planning-week .match-card-summary').filter({ hasText: 'Ingenieros de Soria' }).click()
  await page.getByRole('button', { name: 'Subir acta' }).click()
  const dialog = page.getByRole('dialog', { name: 'Subir acta' })
  await expect(dialog.getByLabel('Acta en PDF')).toBeVisible()
  await expect(dialog.getByLabel('Puntos del equipo')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Guardar acta' })).toBeVisible()
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
})
