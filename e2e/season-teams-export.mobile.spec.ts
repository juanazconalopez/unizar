import { expect, test } from '@playwright/test'

test('team PDF preview and save action fit on mobile', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('menuitem', { name: 'Temporadas' }).click()
  await page.locator('.season-card').first().getByRole('button', { name: 'Gestionar equipos' }).click()
  const dialog = page.getByRole('dialog', { name: 'Equipos' })
  await dialog.getByRole('button', { name: 'Exportar PDF' }).click()
  await expect(dialog.getByRole('article')).toContainText('Unizar Femenino')
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: '/tmp/unizar-equipos-pdf-mobile.png', fullPage: true })
  await page.evaluate(() => { window.print = () => { document.body.dataset.printed = 'true' } })
  await dialog.getByRole('button', { name: 'Guardar PDF' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-printed', 'true')
  await dialog.getByRole('button', { name: 'Volver a equipos' }).click()
  await expect(dialog.getByRole('button', { name: 'Nuevo equipo' })).toBeVisible()
})
