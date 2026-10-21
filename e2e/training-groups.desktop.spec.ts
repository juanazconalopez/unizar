import { test } from '@playwright/test'
import { checkIndividualTrainingGroupChanges, checkTrainingGroups } from './trainingGroups'

test('groups can be generated, reviewed and published on desktop', async ({ page }, testInfo) => {
  await checkTrainingGroups(page, testInfo)
})

test('gestiona integrantes individuales del reparto publicado en escritorio', async ({ page }, testInfo) => {
  await checkIndividualTrainingGroupChanges(page, testInfo)
})
