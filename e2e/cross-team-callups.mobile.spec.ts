import { test } from '@playwright/test'
import { checkCrossTeamCallups } from './crossTeamCallups'

test('limits published callups to seven shared players and requires the previous acta on mobile', async ({ page }, testInfo) => {
  await checkCrossTeamCallups(page, testInfo.project.name)
})
