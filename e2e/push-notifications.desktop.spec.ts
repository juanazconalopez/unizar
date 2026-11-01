import { test } from '@playwright/test'
import { checkPushSettings } from './pushNotifications'

test('permite configurar push en escritorio sin peticiones reales en la demo', async ({ page }, testInfo) => {
  await checkPushSettings(page, testInfo)
})
