import { expect, type Page, type TestInfo } from '@playwright/test'

function derbyPdf() {
  const rows: [number, number, string][] = [
    [10, 810, '17/10/2026'], [10, 233, 'Resultado del partido'], [90, 218, 'Unizar A'], [420, 218, 'Unizar B'], [280, 200, '80 - 0'],
    [280, 584, 'Cambios'], [20, 548, 'Dorsal entra'], [100, 548, '16'], [20, 536, 'Dorsal sale'], [100, 536, '2'], [20, 524, 'Minuto'], [100, 524, '70'],
    [20, 488, 'Dorsal entra'], [100, 488, '16'], [160, 488, '17'], [20, 476, 'Dorsal sale'], [100, 476, '4'], [160, 476, '6'], [20, 464, 'Minuto'], [100, 464, '40'], [160, 464, '40'],
    [120, 404, 'Expulsiones temporales'],
  ]
  const content = rows.map(([x, y, value]) => `BT /F1 12 Tf 1 0 0 1 ${x} ${y} Tm (${value}) Tj ET`).join('\n')
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const start = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`
  return { name: 'derbi.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) }
}
async function openScenario(page: Page) {
  await page.clock.install({ time: new Date('2026-10-22T12:00:00+02:00') })
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Partidos' }).click()
  return page.getByRole('region', { name: 'Escenario de solo entrenamientos' })
}
export async function correctHistoricalDerby(page: Page, info: TestInfo) {
  const storageRequests: string[] = []
  page.on('request', (request) => { if (request.url().includes('/storage/v1/')) storageRequests.push(request.url()) })
  const scenario = await openScenario(page)
  await scenario.getByRole('button', { name: 'Resultado y minutos del derbi de prueba' }).click()
  const report = page.getByRole('dialog', { name: 'Resultado y minutos' })
  await report.getByLabel('Importar acta PDF (opcional)').setInputFiles(derbyPdf())
  await expect(report.getByLabel('Puntos del equipo')).toHaveValue('80')
  await report.getByRole('tab', { name: 'Unizar B' }).click()
  await expect(report.getByLabel('Jugadora que entra en el evento 2')).toHaveValue('')
  await expect(report.getByRole('region', { name: 'Vista previa de minutos' })).toContainText('Nerea Andrés')
  await expect(report.getByText('Pendiente', { exact: true })).toHaveCount(16)
  await report.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await scenario.getByRole('button', { name: 'Disponibilidad del derbi de prueba' }).click()
  const availability = page.getByRole('dialog').filter({ has: page.getByRole('tablist', { name: 'Equipos del derbi' }) })
  await expect(availability.getByRole('tab', { name: 'Unizar B' })).toHaveAttribute('aria-selected', 'true')
  await availability.getByRole('button', { name: 'Añadir de solo entrenamientos' }).click()
  const editor = page.getByRole('dialog', { name: 'Añadir de solo entrenamientos' })
  await editor.getByLabel('Jugadora', { exact: true }).selectOption({ label: 'Leyre Pérez Gimeno' })
  await editor.getByLabel('Dorsal del acta').selectOption('17')
  await expect(editor.getByRole('button', { name: 'Añadir al partido' })).toBeDisabled()
  await editor.getByLabel(/Confirmo que esta jugadora participó/).check()
  await page.screenshot({ path: `/tmp/unizar-training-exception-${info.project.name}.png`, fullPage: true })
  expect(await editor.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await editor.getByRole('button', { name: 'Añadir al partido' }).click()
  await expect(editor).toBeHidden()
  await expect(availability).toContainText('Solo entrenamientos · Autorizada para este partido')
  await availability.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await scenario.getByRole('button', { name: 'Resultado y minutos del derbi de prueba' }).click()
  await report.getByLabel('Importar acta PDF (opcional)').setInputFiles(derbyPdf())
  await expect(report.getByLabel('Puntos del equipo')).toHaveValue('80')
  await report.getByRole('tab', { name: 'Unizar B' }).click()
  await expect(report.getByLabel('Jugadora que entra en el evento 2')).toHaveValue('training-exception-leyre')
  const minutes = report.getByRole('region', { name: 'Vista previa de minutos' })
  await expect(minutes.locator('dl > div')).toHaveCount(17)
  await expect(minutes.locator('dl > div').filter({ hasText: 'Leyre Pérez Gimeno' })).toContainText('40 min')
  await expect(minutes.locator('dl > div').filter({ hasText: 'Nerea Andrés' })).toContainText('40 min')
  await minutes.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `/tmp/unizar-derby-minutes-${info.project.name}.png`, fullPage: true })
  await report.getByLabel(/Confirmo que el partido/).check()
  await report.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(report).toBeHidden()
  await scenario.getByRole('button', { name: 'Resultado y minutos del derbi de prueba' }).click()
  await report.getByRole('tab', { name: 'Unizar B' }).click()
  await expect(report.getByLabel('Jugadora que entra en el evento 2')).toHaveValue('training-exception-leyre')
  await expect(report.getByLabel('Puntos del equipo')).toHaveValue('0')
  expect(storageRequests).toEqual([])
}
export async function authorizeFuturePlayer(page: Page) {
  const scenario = await openScenario(page)
  await page.getByLabel('Ver como').selectOption('coach')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Partidos' }).click()
  await scenario.getByRole('button', { name: 'Disponibilidad del próximo partido de prueba' }).click()
  await page.getByRole('button', { name: 'Añadir de solo entrenamientos' }).click()
  const editor = page.getByRole('dialog', { name: 'Añadir de solo entrenamientos' })
  await editor.getByLabel('Jugadora', { exact: true }).selectOption({ label: 'Leyre Pérez Gimeno' })
  await expect(editor.getByLabel('Dorsal del acta')).toHaveCount(0)
  await editor.getByRole('button', { name: 'Añadir al partido' }).click()
  await expect(editor).toBeHidden()
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click()
  await scenario.getByRole('button', { name: 'Preparar convocatoria del próximo partido de prueba' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Guardar alineación' })).toBeEnabled()
  await page.getByRole('button', { name: 'Guardar alineación' }).click()
  await scenario.getByRole('button', { name: 'Preparar convocatoria del próximo partido de prueba' }).click()
  await expect(page.getByRole('button', { name: 'Quitar a Leyre Pérez Gimeno' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click()
  await page.getByLabel('Ver como').selectOption('viewer')
  await expect(page.getByRole('button', { name: 'Añadir de solo entrenamientos' })).toHaveCount(0)
  await expect(scenario).toHaveCount(0)
}
