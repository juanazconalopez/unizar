import { expect } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'
import { readFile } from 'node:fs/promises'

export async function checkProfileAppVersion(page: Page, testInfo: TestInfo) {
  const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  const [major, minor, patch] = version.split('.').map(Number)
  const latestVersion = `${major}.${minor}.${patch + 1}`
  await page.route('**/version.json?*', (route) => route.fulfill({ json: { version: latestVersion } }))
  await page.goto('/')
  if (testInfo.project.name === 'desktop-chromium') {
    await page.locator('.sidebar').getByRole('button', { name: 'Editar mis datos' }).click()
  } else {
    await page.getByRole('button', { name: 'Abrir menú de usuario' }).click()
    await page.getByRole('menuitem', { name: 'Editar mis datos' }).click()
  }
  const dialog = page.getByRole('dialog', { name: 'Datos de perfil' })
  await expect(dialog.getByText(`Versión ${version}`)).toBeVisible()
  await expect(dialog.getByRole('button', { name: `Actualizar a ${latestVersion}` })).toBeVisible()
  await dialog.locator('.profile-app-version').scrollIntoViewIfNeeded()
  const versionBox = await dialog.locator('.profile-app-version').boundingBox()
  expect(versionBox).not.toBeNull()
  expect(versionBox!.x).toBeGreaterThanOrEqual(0)
  expect(versionBox!.x + versionBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.screenshot({ path: testInfo.outputPath('profile-version.png') })
  await dialog.getByRole('button', { name: `Actualizar a ${latestVersion}` }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.demo-toolbar')).toBeVisible()
}
