import { expect, test } from '@playwright/test'
import type { Route } from '@playwright/test'

test('a stalled launch photo does not block access to the application', async ({ page }) => {
  const pendingPhotos: Route[] = []
  await page.route(/\/src\/assets\/finalLiga2026\/.*\.webp/, (route) => {
    if (route.request().resourceType() === 'image') pendingPhotos.push(route)
    else void route.continue()
  })
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.launch-splash')).toHaveCount(0)
    expect(pendingPhotos.length).toBeGreaterThan(0)
    await page.getByRole('button', { name: 'Gestión' }).click()
    await expect(page.getByRole('menuitem', { name: 'Entrenamientos' })).toBeVisible()
  } finally {
    await Promise.all(pendingPhotos.map((route) => route.abort()))
  }
})
