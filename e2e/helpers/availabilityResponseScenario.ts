import { expect, type Page, type TestInfo } from '@playwright/test'

export async function checkFirstDoubtResponse(page: Page, info: TestInfo) {
  await page.clock.install({ time: new Date('2026-09-24T12:00:00+02:00') })
  await page.goto('/')
  // Crea un partido sin respuestas previas para comprobar la primera respuesta.
  await page.getByRole('button', { name: 'Calendario', exact: true }).click()
  await page.getByRole('button', { name: 'Añadir', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Nuevo partido', exact: true }).click()
  const matchForm = page.getByRole('dialog', { name: 'Nuevo partido' })
  await matchForm.getByLabel('Rival', { exact: true }).fill('Íbero CR')
  await matchForm.getByLabel('Estado').selectOption('published')
  await matchForm.getByRole('button', { name: 'Guardar partido', exact: true }).click()
  await page.getByLabel('Ver como').selectOption('player')
  await page.getByRole('button', { name: 'Calendario', exact: true }).click()
  const card = page.locator('.selected-day-matches .match-card').filter({ hasText: 'Íbero CR' })
  for (const name of ['Asistiré', 'En duda', 'No asistiré']) {
    await expect(card.getByRole('button', { name, exact: true })).toBeVisible()
  }
  await card.getByRole('button', { name: /Ver detalle de.*Íbero CR/ }).click()
  const detail = page.locator('.match-detail-dialog')
  const actions = detail.locator('.availability-response-actions')
  await actions.scrollIntoViewIfNeeded()
  const viewport = page.viewportSize()!
  const buttons = await actions.getByRole('button').all()
  expect(buttons).toHaveLength(3)
  const boxes = await Promise.all(buttons.map((button) => button.boundingBox()))
  for (let index = 1; index < boxes.length; index += 1) {
    const previous = boxes[index - 1]!, current = boxes[index]!
    if (viewport.width <= 680) {
      expect(current.y).toBeGreaterThanOrEqual(previous.y + previous.height)
      expect(Math.abs(current.x - previous.x)).toBeLessThan(2)
      expect(current.height).toBeGreaterThanOrEqual(44)
    } else expect(Math.abs(current.y - previous.y)).toBeLessThan(2)
  }
  expect(await detail.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: `/tmp/unizar-availability-${info.project.name}-initial.png`, fullPage: true })

  // Cancelar cualquiera de las respuestas mantiene el partido sin responder.
  await detail.getByRole('button', { name: 'En duda', exact: true }).click()
  const form = page.locator('.availability-dialog')
  await expect(form.getByLabel('Respuesta')).toHaveValue('doubt')
  await form.getByLabel('Comentario opcional').fill('Sin confirmar todavía')
  await form.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(detail.locator('.own-availability')).toHaveCount(0)
  await detail.getByRole('button', { name: 'No asistiré', exact: true }).click()
  await expect(form.getByLabel('Respuesta')).toHaveValue('unavailable')
  await form.getByRole('button', { name: 'Cancelar', exact: true }).click()

  await detail.getByRole('button', { name: 'En duda', exact: true }).click()
  await expect(form.getByLabel('Comentario opcional')).toBeFocused()
  await form.getByLabel('Comentario opcional').fill('Pendiente de confirmar el turno de trabajo')
  if (viewport.width <= 680) {
    // Comprueba el formulario con menos altura útil, como al abrir el teclado.
    await page.setViewportSize({ width: viewport.width, height: 500 })
  }
  const save = form.getByRole('button', { name: 'Guardar respuesta', exact: true })
  await save.scrollIntoViewIfNeeded()
  await expect(save).toBeInViewport()
  expect(await form.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: `/tmp/unizar-availability-${info.project.name}-comment.png`, fullPage: true })
  await save.click()
  if (viewport.width <= 680) await page.setViewportSize(viewport)
  await expect(form).toHaveCount(0)
  await expect(detail.locator('.own-availability')).toContainText('Estás en duda')
  await expect(detail.locator('.own-availability')).toContainText('Pendiente de confirmar el turno de trabajo')
  await detail.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(card.locator('.own-availability')).toContainText('Estás en duda')
  await expect(card.locator('.own-availability')).toContainText('Pendiente de confirmar el turno de trabajo')

  // La respuesta y el comentario siguen disponibles al volver a abrir el partido.
  await card.getByRole('button', { name: /Ver detalle de.*Íbero CR/ }).click()
  await detail.getByRole('button', { name: 'Modificar respuesta', exact: true }).click()
  await expect(form.getByLabel('Respuesta')).toHaveValue('doubt')
  await expect(form.getByLabel('Comentario opcional')).toHaveValue('Pendiente de confirmar el turno de trabajo')
  await form.getByLabel('Comentario opcional').fill('Pendiente de revisión médica')
  await form.getByRole('button', { name: 'Guardar respuesta', exact: true }).click()
  await expect(detail.locator('.own-availability')).toContainText('Pendiente de revisión médica')
}
