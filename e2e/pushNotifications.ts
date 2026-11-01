import { expect, type Page, type TestInfo } from '@playwright/test'

export async function checkPushSettings(page: Page, testInfo: TestInfo) {
  const requests: string[] = []
  page.on('request', (request) => { if (/\/(rest|functions|auth)\/v1\//.test(request.url())) requests.push(request.url()) })
  await page.goto('/')
  const bell = page.locator('.notification-button:visible').first()
  await bell.click()
  const settings = page.getByRole('region', { name: 'Notificaciones en este dispositivo' })
  await expect(settings).toBeVisible()
  await settings.getByRole('button', { name: 'Activar notificaciones' }).click()
  await expect(settings.getByRole('button', { name: 'Desactivar notificaciones' })).toBeEnabled()
  await settings.getByLabel('Publicación y cambios de convocatorias').uncheck()
  await settings.getByRole('button', { name: 'Enviar notificación de prueba' }).click()
  await expect(settings.getByText('Prueba simulada. La demo no envía notificaciones.')).toBeVisible()
  const bounds = await settings.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.screenshot({ path: `/tmp/unizar-push-${testInfo.project.name}.png`, fullPage: true })
  await settings.getByRole('button', { name: 'Desactivar notificaciones' }).click()
  await expect(settings.getByRole('button', { name: 'Activar notificaciones' })).toBeEnabled()
  expect(requests).toEqual([])
}
