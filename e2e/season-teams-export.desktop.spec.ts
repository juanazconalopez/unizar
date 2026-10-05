import { expect, test } from '@playwright/test'

test('exports every season roster to a printable PDF regardless of the player search', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-09-24T12:00:00+02:00') })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('menuitem', { name: 'Temporadas' }).click()
  await page.locator('.season-card').first().getByRole('button', { name: 'Gestionar equipos' }).click()
  const dialog = page.getByRole('dialog', { name: 'Equipos' })
  await dialog.getByRole('searchbox').fill('Marta')
  await dialog.getByRole('button', { name: 'Exportar PDF' }).click()
  const report = dialog.getByRole('article', { name: 'Vista previa del PDF de equipos' })
  await expect(report).toContainText('Sara Jiménez')
  await expect(report).toContainText('Equipo de desarrollo')
  await expect(report).toContainText('Entrenador principal')
  await expect(report).toContainText('Andrea López')
  await expect(report).toContainText('Baja deportiva')
  const originalTitle = await page.title()
  await page.evaluate(() => { window.print = () => { document.body.dataset.printedTitle = document.title } })
  await dialog.getByRole('button', { name: 'Guardar PDF' }).click()
  await expect(page.locator('body')).toHaveAttribute('data-printed-title', 'Equipos - Temporada 2026/2027')
  expect(await page.title()).toBe(originalTitle)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#root')).toBeHidden()
  await expect(dialog.getByRole('button', { name: 'Guardar PDF' })).toBeHidden()
  await expect(report).toBeVisible()
  const pdf = await page.pdf({ path: testInfo.outputPath('equipos.pdf'), preferCSSPageSize: true, printBackground: true })
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  // Exercise pagination and long names without changing the demo's saved roster.
  await report.evaluate((element) => {
    const body = element.querySelector('tbody')!
    const template = body.querySelector('tr:not(.teams-report-position-group)')!
    for (let index = 1; index <= 60; index += 1) {
      const row = template.cloneNode(true) as HTMLTableRowElement
      row.querySelector('th')!.textContent = `Jugadora de prueba ${index} con nombre y apellidos completos para comprobar los saltos de línea`
      body.appendChild(row)
    }
  })
  await page.pdf({ path: testInfo.outputPath('equipos-multipagina.pdf'), preferCSSPageSize: true, printBackground: true })
  await page.emulateMedia({ media: 'screen' })
  await dialog.getByRole('button', { name: 'Volver a equipos' }).click()
  await expect(dialog.getByRole('searchbox')).toHaveValue('Marta')
})
