import { expect, type Page } from '@playwright/test'

export async function checkWeekendAvailability(page: Page) {
  await page.clock.install({ time: new Date('2026-09-24T12:00:00+02:00') })
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Partidos', exact: true }).click()
  await page.getByRole('button', { name: 'Resumen de convocatorias' }).click()
  const row = page.getByRole('table').getByRole('row').filter({ hasText: 'Marta Sánchez' })
  const availability = row.locator('td').nth(4).locator('strong')
  const [initialResponses, initialMatches] = (await availability.innerText()).split('/').map(Number)
  await page.getByRole('button', { name: 'Volver a partidos' }).click()

  for (const [date, team, opponent] of [
    ['2026-10-17', 'demo-team-default', 'Rival del sábado'],
    ['2026-10-18', 'demo-team-development', 'Rival del domingo'],
  ]) {
    await page.getByRole('button', { name: 'Nuevo partido', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'Nuevo partido' })
    await form.getByLabel('Rival', { exact: true }).fill(opponent)
    await form.getByLabel('Fecha', { exact: true }).fill(date)
    await form.getByRole('combobox', { name: 'Equipo', exact: true }).selectOption(team)
    await form.getByLabel('Estado').selectOption('published')
    await form.getByRole('button', { name: 'Guardar partido' }).click()
    await page.locator('.match-card').filter({ hasText: opponent }).getByRole('button', { name: /Ver detalle/ }).click()
    await page.getByRole('button', { name: 'Ver disponibilidades' }).click()
    await page.locator('.availability-group article').filter({ hasText: 'Marta Sánchez' }).getByRole('button', { name: 'Editar', exact: true }).click()
    const response = page.getByRole('dialog', { name: 'Marta Sánchez', exact: true })
    await response.getByLabel('Respuesta').selectOption('available')
    await response.getByRole('button', { name: 'Guardar disponibilidad' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click()
  }

  await page.getByRole('button', { name: 'Resumen de convocatorias' }).click()
  await expect(availability).toHaveText(`${initialResponses + 1}/${initialMatches + 1}`)
  await page.getByRole('button', { name: 'Volver a partidos' }).click()

  async function editLineup(opponent: string) {
    await page.locator('.match-card').filter({ hasText: opponent }).getByRole('button', { name: /Ver detalle/ }).click()
    await page.getByRole('button', { name: 'Preparar convocatoria', exact: true }).click()
    return page.getByRole('dialog').filter({ has: page.locator('.available-player-pool') })
  }

  let editor = await editLineup('Rival del sábado')
  await editor.locator('.available-player-pool article').filter({ hasText: 'Marta Sánchez' }).getByRole('button', { name: 'Añadir' }).click()
  await editor.getByRole('combobox', { name: 'Posición de Marta Sánchez' }).selectOption('16')
  await editor.getByRole('button', { name: 'Guardar alineación' }).click()

  editor = await editLineup('Rival del domingo')
  const reservedPlayer = editor.locator('.available-player-pool article').filter({ hasText: 'Marta Sánchez' })
  await expect(reservedPlayer).toContainText('Convocada en otro partido')
  await expect(reservedPlayer).toContainText('Unizar Femenino')
  await expect(reservedPlayer.getByRole('button', { name: 'Añadir' })).toBeDisabled()
  await expect(reservedPlayer).toHaveAttribute('draggable', 'false')
  expect(await editor.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: `/tmp/unizar-weekend-reservations-${page.viewportSize()?.width}.png` })
  await editor.getByRole('button', { name: 'Cancelar', exact: true }).click()

  // Quitar y guardar libera también las suplentes. El préstamo sustituye al partido propio.
  editor = await editLineup('Rival del sábado')
  await editor.getByRole('button', { name: 'Quitar a Marta Sánchez' }).click()
  await editor.getByRole('button', { name: 'Guardar alineación' }).click()
  editor = await editLineup('Rival del domingo')
  await expect(editor.locator('.available-player-pool article').filter({ hasText: 'Marta Sánchez' }).getByRole('button', { name: 'Añadir' })).toBeEnabled()
  await editor.locator('.available-player-pool article').filter({ hasText: 'Marta Sánchez' }).getByRole('button', { name: 'Añadir' }).click()
  await editor.getByRole('button', { name: 'Guardar alineación' }).click()

  await page.getByRole('button', { name: 'Resumen de convocatorias' }).click()
  await expect(availability).toHaveText(`${initialResponses + 1}/${initialMatches + 1}`)
  await row.getByRole('button', { name: 'Marta Sánchez', exact: true }).click()
  const summary = page.getByRole('dialog', { name: 'Marta Sánchez', exact: true })
  await expect(summary).toContainText(`${initialResponses + 1}/${initialMatches + 1} respuestas`)
  await expect(summary.locator('.season-match-history article')).toHaveCount(initialMatches + 1)
  await expect(summary.locator('.season-match-history')).toContainText('Rival del domingo')
  await expect(summary.locator('.season-match-history')).not.toContainText('Rival del sábado')
}
