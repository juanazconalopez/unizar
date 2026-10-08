import { test } from '@playwright/test'
import { checkTeamColors } from './teamColors'

test('team colors persist and update reassigned match cards and calendar markers', async ({ page }, testInfo) => {
  await checkTeamColors(page, testInfo.project.name)
})
