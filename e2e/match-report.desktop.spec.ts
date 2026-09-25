import { expect, test } from '@playwright/test'

function sampleReportPdf() {
  const content = [
    'BT /F1 12 Tf 1 0 0 1 10 233 Tm (Resultado del partido) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 90 218 Tm (Unizar femenino) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 420 218 Tm (Ingenieros de Soria) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 280 200 Tm (46 - 7) Tj ET',
  ].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const start = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`
  return Buffer.from(pdf)
}

test('owner uploads a past match report and reviews the extracted score', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-24T12:00:00+02:00') })
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Partidos' }).click()
  await page.getByRole('button', { name: 'Mes anterior' }).click()
  await page.getByRole('button', { name: /: 1 partido/ }).click()
  await page.locator('.selected-planning-week .match-card-summary').filter({ hasText: 'Ingenieros de Soria' }).click()
  await page.getByRole('button', { name: 'Subir acta' }).click()
  const dialog = page.getByRole('dialog', { name: 'Subir acta' })
  await dialog.getByLabel('Acta en PDF').setInputFiles({ name: 'acta.pdf', mimeType: 'application/pdf', buffer: sampleReportPdf() })
  await expect(dialog.getByLabel('Puntos del equipo')).toHaveValue('46')
  await expect(dialog.getByLabel('Puntos del rival')).toHaveValue('7')
  await dialog.getByRole('button', { name: 'Guardar acta' }).click()
  await expect(page.getByText('Acta guardada en la demo.')).toBeVisible()
  await page.locator('.selected-planning-week .match-card-summary').filter({ hasText: 'Ingenieros de Soria' }).click()
  await expect(page.getByRole('dialog')).toContainText('46 - 7')
  await expect(page.getByRole('button', { name: 'Ver PDF del acta' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByLabel('Ver como').selectOption('player')
  await page.getByRole('button', { name: 'Calendario' }).click()
  await page.getByRole('button', { name: 'Mes anterior' }).click()
  await page.getByRole('button', { name: / y 1 partido/ }).click()
  await page.locator('.selected-day-matches .match-card-summary').filter({ hasText: 'Ingenieros de Soria' }).click()
  await expect(page.getByRole('dialog')).toContainText('46 - 7')
  await expect(page.getByRole('button', { name: 'Ver PDF del acta' })).toHaveCount(0)
})
