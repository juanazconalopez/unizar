import { test } from '@playwright/test'
import { checkProfileAppVersion } from './appVersion'

test('personal profile shows the device version and offers a manual update on desktop', async ({ page }, testInfo) => {
  await checkProfileAppVersion(page, testInfo)
})
