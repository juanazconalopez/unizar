import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function checkPastedTrainingImage(page: Page) {
  await page.clock.install({ time: new Date('2026-09-24T12:00:00+02:00') })
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Entrenamientos' }).click()
  await page.getByRole('button', { name: /Editar entrenamiento/ }).first().click()
  const description = page.getByRole('textbox', { name: 'Descripción', exact: true }).first()
  await description.fill('Antes de la imagen. Después de la imagen.')
  await description.evaluate((editor) => {
    editor.innerHTML = '<strong>Antes de la imagen.</strong><em> Después de la imagen.</em>'
    editor.dispatchEvent(new InputEvent('input', { bubbles: true }))
    const range = document.createRange()
    range.setStartAfter(editor.firstChild!)
    range.collapse(true)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    const canvas = document.createElement('canvas')
    canvas.width = 120
    canvas.height = 80
    canvas.getContext('2d')!.fillRect(0, 0, 120, 80)
    canvas.toBlob((blob) => {
      const clipboardData = new DataTransfer()
      clipboardData.items.add(new File([blob!], 'ejercicio.png', { type: 'image/png' }))
      editor.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }))
    }, 'image/png')
  })
  await expect(page.getByText(/^Imagen preparada\. Se subirá al guardar\./)).toBeVisible()
  await expect(description).toContainText('[[imagen:')
  await page.locator('.content-image-preview').first().scrollIntoViewIfNeeded()
  await expect(page.getByAltText('Imagen adjunta')).toBeVisible()
  await expect(description).toHaveText(/^Antes de la imagen\.\s*\[\[imagen:[a-f0-9-]+\]\]\s*Después de la imagen\.$/)
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click()
  await page.getByRole('button', { name: /Ver entrenamiento/ }).first().click()
  await expect(page.locator('.training-detail-instructions').first()).toContainText('Antes de la imagen.')
  await expect(page.locator('.training-detail-instructions').first()).toContainText('Después de la imagen.')
  await page.locator('.training-detail-instructions .content-image-host').first().scrollIntoViewIfNeeded()
  await expect(page.getByAltText('Imagen adjunta')).toBeVisible()
  await expect(page.locator('.training-detail-instructions').first().locator('strong')).toHaveText('Antes de la imagen.')
  await expect(page.locator('.training-detail-instructions').first().locator('em')).toHaveText('Después de la imagen.')
  await expect(page.getByAltText('Imagen adjunta')).toHaveJSProperty('naturalWidth', 120)
}
