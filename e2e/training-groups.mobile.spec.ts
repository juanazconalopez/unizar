import { test } from '@playwright/test'
import { checkIndividualTrainingGroupChanges, checkTrainingGroups } from './trainingGroups'

test('groups can be generated, reviewed and published, with private drafts and player notifications', async ({ page }, testInfo) => {
  await checkTrainingGroups(page, testInfo)
})

test('gestiona integrantes individuales del reparto publicado en móvil', async ({ page }, testInfo) => {
  await checkIndividualTrainingGroupChanges(page, testInfo)
})
