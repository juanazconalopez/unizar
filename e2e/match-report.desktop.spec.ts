import { expect, test } from '@playwright/test'

function sampleReportPdf() {
  const content = [
    'BT /F1 12 Tf 1 0 0 1 10 233 Tm (Resultado del partido) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 90 218 Tm (Unizar femenino) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 420 218 Tm (Ingenieros de Soria) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 280 200 Tm (46 - 7) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 280 584 Tm (Cambios) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 20 548 Tm (Dorsal entra) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 100 548 Tm (16) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 20 536 Tm (Dorsal sale) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 100 536 Tm (1) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 20 524 Tm (Minuto) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 100 524 Tm (55) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 120 404 Tm (Expulsiones temporales) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 14 391 Tm (Equipo local:) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 31 368 Tm (Dorsal) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 100 368 Tm (1) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 31 356 Tm (Minuto) Tj ET',
    'BT /F1 12 Tf 1 0 0 1 100 356 Tm (20) Tj ET',
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

async function openReportMatch(page: import('@playwright/test').Page) {
  await page.clock.install({ time: new Date('2026-09-24T12:00:00+02:00') })
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Partidos' }).click()
  await page.getByRole('button', { name: 'Mes anterior' }).click()
  await page.getByRole('button', { name: /: 1 partido/ }).click()
  await page.locator('.selected-planning-week .match-card-summary').filter({ hasText: 'Ingenieros de Soria' }).click()
  await page.getByRole('button', { name: 'Registrar resultado y minutos' }).click()
}

test('imports a PDF locally and persists only confirmed result and events', async ({ page }) => {
  const storageRequests: string[] = []
  page.on('request', (request) => { if (request.url().includes('/storage/v1/')) storageRequests.push(request.url()) })
  await openReportMatch(page)
  const dialog = page.getByRole('dialog', { name: 'Resultado y minutos' })
  await dialog.getByLabel('Importar acta PDF (opcional)').setInputFiles({ name: 'acta.pdf', mimeType: 'application/pdf', buffer: sampleReportPdf() })
  await expect(dialog.getByLabel('Puntos del equipo')).toHaveValue('46')
  await expect(dialog.getByLabel('Puntos del rival')).toHaveValue('7')
  await expect(dialog.getByLabel('Minuto del evento 1')).toHaveValue('55')
  await expect(dialog.getByLabel('Minuto de regreso del evento 2')).toHaveValue('30')
  await expect(dialog.getByText('45 min', { exact: true })).toBeVisible()
  await expect(dialog.getByText('25 min', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled()
  await dialog.getByLabel(/Confirmo que el partido/).check()
  await page.screenshot({ path: '/tmp/unizar-match-result-desktop.png', fullPage: true })
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Resultado y minutos guardados en la demo.')).toBeVisible()
  await page.locator('.selected-planning-week .match-card-summary').filter({ hasText: 'Ingenieros de Soria' }).click()
  await expect(page.getByRole('dialog')).toContainText('46 - 7')
  await expect(page.getByRole('button', { name: 'Ver PDF del acta' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Editar resultado y minutos' }).click()
  await expect(dialog.getByLabel('Minuto del evento 1')).toHaveValue('20')
  await expect(dialog.getByLabel('Minuto del evento 2')).toHaveValue('55')
  await expect(dialog.getByText('45 min', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByLabel('Ver como').selectOption('player')
  await page.getByRole('button', { name: 'Calendario' }).click()
  await page.getByRole('button', { name: 'Mes anterior' }).click()
  await page.getByRole('button', { name: / y 1 partido/ }).click()
  await page.locator('.selected-day-matches .match-card-summary').filter({ hasText: 'Ingenieros de Soria' }).click()
  await expect(page.getByRole('dialog')).toContainText('46 - 7')
  await expect(page.getByRole('button', { name: 'Editar resultado y minutos' })).toHaveCount(0)
  expect(storageRequests).toEqual([])
})

test('cancelled PDF imports are discarded and a result can be recorded manually', async ({ page }) => {
  await openReportMatch(page)
  const dialog = page.getByRole('dialog', { name: 'Resultado y minutos' })
  await dialog.getByLabel('Importar acta PDF (opcional)').setInputFiles({ name: 'acta.pdf', mimeType: 'application/pdf', buffer: sampleReportPdf() })
  await expect(dialog.getByLabel('Puntos del equipo')).toHaveValue('46')
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Resultado del partido' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Registrar resultado y minutos' }).click()
  await expect(dialog.getByLabel('Puntos del equipo')).toHaveValue('')
  await dialog.getByLabel('Puntos del equipo').fill('12')
  await dialog.getByLabel('Puntos del rival').fill('7')
  await dialog.getByRole('button', { name: 'Añadir evento' }).click()
  const outgoing = await dialog.getByLabel('Jugadora del evento 1').getByRole('option', { name: /#1 / }).getAttribute('value')
  const incoming = await dialog.getByLabel('Jugadora que entra en el evento 1').getByRole('option', { name: /#16 / }).getAttribute('value')
  await dialog.getByLabel('Jugadora del evento 1').selectOption(outgoing!)
  await dialog.getByLabel('Jugadora que entra en el evento 1').selectOption(incoming!)
  await dialog.getByLabel('Minuto del evento 1').fill('40')
  await expect(dialog.getByText('40 min', { exact: true })).toHaveCount(2)
  await dialog.getByLabel(/Confirmo que el partido/).check()
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Resultado y minutos guardados en la demo.')).toBeVisible()
})
