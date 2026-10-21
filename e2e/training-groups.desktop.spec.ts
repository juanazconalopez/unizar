import { test } from '@playwright/test'
import { checkTrainingGroups } from './trainingGroups'

test('groups can be generated, reviewed and published on desktop', async ({ page }, testInfo) => {
  await checkTrainingGroups(page, testInfo)
})
