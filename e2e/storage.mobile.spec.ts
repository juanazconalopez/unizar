import { expect, test } from '@playwright/test'
import { checkPastedTrainingImage } from './trainingImagesScenario'

for (const storageState of ['blocked', 'full'] as const) {
  test(`training images can be pasted and saved when browser storage is ${storageState}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript((state) => {
      if (state === 'blocked') {
        for (const name of ['localStorage', 'caches']) {
          Object.defineProperty(window, name, {
            configurable: true,
            get() { throw new DOMException('Almacenamiento bloqueado', 'SecurityError') },
          })
        }
      } else {
        Storage.prototype.setItem = () => { throw new DOMException('Almacenamiento lleno', 'QuotaExceededError') }
        if (typeof Cache !== 'undefined') {
          Cache.prototype.put = async () => { throw new DOMException('Almacenamiento lleno', 'QuotaExceededError') }
        }
      }
    }, storageState)

    await checkPastedTrainingImage(page)
    expect(errors).toEqual([])
  })
}
