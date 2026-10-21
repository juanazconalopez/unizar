import { test } from '@playwright/test'
import { checkTrainingGroups } from './trainingGroups'

test('groups can be generated, reviewed and published, with private drafts and player notifications', async ({ page }, testInfo) => {
  await checkTrainingGroups(page, testInfo)
})
