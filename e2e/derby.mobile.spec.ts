import { expect, test } from '@playwright/test'

test('owner assigns any dorsal in the real derby editor on mobile', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Partidos' }).click()
  await page.getByRole('button', { name: 'Gestionar convocatorias del derbi' }).click()

  const review = page.getByRole('dialog', { name: 'Unizar A vs Unizar B' })
  await review.getByRole('button', { name: 'Editar convocatoria de Unizar A' }).click()
  const editor = page.getByRole('dialog')
  await editor.locator('.available-player-pool article').filter({ hasText: 'Aitana Ruiz' }).getByRole('button', { name: 'Añadir' }).click()
  await editor.locator('.available-player-pool article').filter({ hasText: 'Nora Martín' }).getByRole('button', { name: 'Añadir' }).click()

  await editor.getByRole('combobox', { name: 'Posición de Nora Martín' }).selectOption('15')
  await expect(editor.getByRole('combobox', { name: 'Posición de Nora Martín' })).toHaveValue('15')
  await expect(editor.getByRole('combobox', { name: 'Posición de Nora Martín' }).locator('option[value="1"]')).toHaveCount(0)
  await editor.getByRole('button', { name: 'Quitar a Aitana Ruiz' }).click()
  await editor.getByRole('combobox', { name: 'Posición de Nora Martín' }).selectOption('1')
  await expect(editor.getByRole('combobox', { name: 'Posición de Nora Martín' })).toHaveValue('1')
  await editor.getByRole('button', { name: 'Guardar alineación' }).click()
  await expect(page.getByRole('dialog', { name: 'Unizar A vs Unizar B' })).toContainText('1/23')
})
