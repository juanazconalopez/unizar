import { expect, test } from '@playwright/test'
import { checkSharedDerbyAvailability } from './derbySharedAvailability'
import { checkWeekendAvailability } from './weekendAvailability'
import { checkUniqueAvailabilityReports } from './uniqueAvailabilityReports'

test('availability reports count each derby once and discard a deleted fixture', async ({ page }) => {
  await checkUniqueAvailabilityReports(page)
})

test('owner reorders the real derby lineup by dragging a player', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Partidos' }).click()
  await page.getByRole('button', { name: 'Gestionar convocatorias del derbi' }).click()
  await page.getByRole('button', { name: 'Editar convocatoria de Unizar A' }).click()

  const editor = page.getByRole('dialog')
  const slots = editor.locator('.lineup-slot')
  await editor.locator('.available-player-pool article').filter({ hasText: 'Aitana Ruiz' }).dragTo(slots.nth(0))
  await editor.locator('.available-player-pool article').filter({ hasText: 'Nora Martín' }).dragTo(slots.nth(1))
  await expect(editor.getByRole('combobox', { name: 'Posición de Aitana Ruiz' })).toHaveValue('1')
  await expect(editor.getByRole('combobox', { name: 'Posición de Nora Martín' })).toHaveValue('2')

  await slots.nth(1).locator('.lineup-player-identity').dragTo(slots.nth(2))
  await expect(editor.getByRole('combobox', { name: 'Posición de Nora Martín' })).toHaveValue('3')
  await expect(editor.getByRole('combobox', { name: 'Posición de Aitana Ruiz' })).toHaveValue('1')
  await slots.nth(2).locator('.lineup-player-identity').dragTo(slots.nth(0))
  await expect(editor.getByRole('combobox', { name: 'Posición de Nora Martín' })).toHaveValue('3')
  await expect(editor.getByRole('combobox', { name: 'Posición de Aitana Ruiz' })).toHaveValue('1')
})

test('owner prepares and publishes B using responses recorded only on the A fixture', async ({ page }) => {
  await checkSharedDerbyAvailability(page)
})

test('separate weekend matches reserve players visibly and count one team opportunity', async ({ page }) => {
  await checkWeekendAvailability(page)
})
