import { expect, test } from '@playwright/test'

test('owner creates and reopens a survey draft on mobile', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Encuestas' }).click()
  await page.getByRole('button', { name: 'Crear encuesta' }).click()

  const editor = page.getByRole('dialog', { name: 'Crear encuesta' })
  await expect(editor.getByLabel('Visibilidad')).toHaveValue('Privada')
  await editor.getByLabel('Título').fill('Encuesta E2E de recuperación')
  await editor.getByRole('textbox', { name: 'Pregunta 1', exact: true }).fill('¿Cómo valoras la recuperación?')
  await editor.getByRole('textbox', { name: 'Opción 1 de pregunta 1', exact: true }).fill('Buena')
  await editor.getByRole('textbox', { name: 'Opción 2 de pregunta 1', exact: true }).fill('Mejorable')
  await editor.getByRole('button', { name: '+ Añadir opción' }).click()
  await editor.getByRole('textbox', { name: 'Opción 3 de pregunta 1', exact: true }).fill('Necesito seguimiento')
  await editor.getByRole('button', { name: '+ Añadir pregunta' }).click()
  await expect(editor.getByLabel('Tipo').nth(1)).toHaveValue('single')
  await editor.getByRole('textbox', { name: 'Pregunta 2', exact: true }).fill('¿Qué cambiarías esta semana?')
  await editor.getByRole('button', { name: 'Guardar borrador' }).click()

  const surveyCard = page.getByRole('button', { name: /Encuesta E2E de recuperación/ })
  await expect(surveyCard).toContainText('Privada')
  await expect(surveyCard).toContainText('Borrador')
  await surveyCard.click()
  const results = page.getByRole('dialog', { name: /Encuesta \d+ · Encuesta E2E de recuperación/ })
  await expect(results.getByRole('button', { name: 'Editar encuesta' })).toBeVisible()
})

test('coach cannot create a private survey', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ver como').selectOption('coach')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Encuestas' }).click()
  await page.getByRole('button', { name: 'Crear encuesta' }).click()

  const editor = page.getByRole('dialog', { name: 'Crear encuesta' })
  await expect(editor.getByLabel('Visibilidad')).toHaveValue('Gestión')
  await expect(editor.getByRole('option', { name: 'Privada' })).toHaveCount(0)
})

test('owner saves a holiday and sees it in the calendar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('menuitem', { name: 'Temporadas' }).click()
  const seasonCard = page.locator('.season-card').filter({ hasText: 'Temporada 2026/2027' })
  await seasonCard.getByRole('button', { name: /Festivos/ }).click()

  const dialog = page.getByRole('dialog', { name: /Festivos · Temporada 2026\/2027/ })
  for (let month = 0; month < 8; month += 1) {
    await dialog.getByRole('button', { name: 'Mes siguiente' }).click()
  }
  await expect(dialog.getByRole('heading', { name: 'septiembre de 2026' })).toBeVisible()
  const ninth = dialog.getByRole('button', { name: '9', exact: true })
  await ninth.click()
  await expect(ninth).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: 'Guardar festivos' }).click()
  await expect(page.getByText('Festivos guardados en la demo.')).toBeVisible()
  await expect(seasonCard.getByRole('button', { name: 'Festivos (4)' })).toBeVisible()

  await page.getByRole('button', { name: 'Calendario' }).click()
  const calendar = page.getByRole('region', { name: 'Calendario de planificación' })
  const holiday = calendar.getByRole('button', { name: /^9 de septiembre:/ })
  await expect(holiday).toHaveClass(/holiday/)
  await holiday.click()
  await expect(page.getByText('Sin entrenamiento de campo programado')).toBeVisible()
})

test('permission dependencies remain consistent when saving on mobile', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('menuitem', { name: 'Permisos' }).click()

  await expect(page.getByRole('heading', { name: 'Permisos por rol' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Owner · acceso completo' })).toHaveAttribute('aria-disabled', 'true')
  const viewTasks = page.getByRole('checkbox', { name: 'Ver tareas del equipo' })
  const editTasks = page.getByRole('checkbox', { name: 'Editar tareas' })
  await expect(viewTasks).toBeChecked()
  await viewTasks.uncheck()
  await expect(editTasks).not.toBeChecked()
  await expect(editTasks).toBeDisabled()
  await page.getByRole('button', { name: 'Guardar permisos' }).click()
  await expect(page.getByText('Permisos guardados en la demo.')).toBeVisible()
})
